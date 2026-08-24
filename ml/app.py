from flask import Flask, request, jsonify
from datetime import datetime, timedelta

app = Flask(__name__)

@app.route('/score', methods=['POST'])
def score_booking():
    booking = request.json or {}
    
    score = 0
    reasons = []
    
    # 1. No payment guarantee (+30)
    payment_status = str(booking.get('payment_status', '')).strip().lower()
    if payment_status in ['unpaid', 'pending', 'failed', 'no guarantee', 'none', '']:
        score += 30
        reasons.append("No payment guarantee")
        
    # 2. Long lead time (+15)
    booking_date_str = booking.get('booking_date')
    check_in_str = booking.get('check_in')
    if booking_date_str and check_in_str:
        try:
            b_date = datetime.strptime(booking_date_str, '%Y-%m-%d')
            c_date = datetime.strptime(check_in_str, '%Y-%m-%d')
            lead_time = (c_date - b_date).days
            if lead_time > 30:
                score += 15
                reasons.append(f"Long lead time ({lead_time} days)")
        except Exception:
            pass
            
    # 3. Peak date placeholder (+15)
    peak_date_triggered = False
    if check_in_str:
        try:
            c_date = datetime.strptime(check_in_str, '%Y-%m-%d')
            month = c_date.month
            day = c_date.day
            # Peak dates: Dec 20 - Jan 5, or Jun 15 - Aug 15
            is_peak = (
                (month == 12 and day >= 20) or 
                (month == 1 and day <= 5) or 
                (month == 6 and day >= 15) or 
                (month == 7) or 
                (month == 8 and day <= 15)
            )
            if is_peak:
                peak_date_triggered = True
        except Exception:
            pass
            
    guest_name = str(booking.get('guest_name', '')).strip().lower()
    is_placeholder = any(x in guest_name for x in ['placeholder', 'tbd', 'test', 'temp', 'dummy'])
    
    if peak_date_triggered or is_placeholder:
        score += 15
        reasons_list = []
        if peak_date_triggered:
            reasons_list.append("Peak date holiday booking")
        if is_placeholder:
            reasons_list.append("Placeholder guest name")
        reasons.append(" / ".join(reasons_list))
        
    # 4. Overlapping dates (+25)
    if booking.get('has_overlap'):
        score += 25
        reasons.append("Overlapping dates/schedule detected")
        
    # 5. Unusual amount (+15)
    try:
        amount = float(booking.get('amount', 0))
        if amount <= 0 or amount > 2000:
            score += 15
            reasons.append(f"Unusual booking amount (${amount:.2f})")
    except Exception:
        score += 15
        reasons.append("Unusual booking amount")
        
    # Determine risk level
    if score >= 65:
        risk_level = 'High'
        recommended_action = 'Require physical ID validation & front-desk payment guarantee'
    elif score >= 35:
        risk_level = 'Medium'
        recommended_action = 'Request updated billing details and call guest to verify'
    else:
        risk_level = 'Low'
        recommended_action = 'Standard welcome protocol'
        
    top_reason = ", ".join(reasons) if reasons else "No risk indicators detected"
    
    # Calculate deadline: 24 hours before check_in, or 2 hours from now if check-in is today
    deadline_str = None
    if check_in_str:
        try:
            c_date = datetime.strptime(check_in_str, '%Y-%m-%d')
            deadline_date = c_date - timedelta(days=1)
            deadline_str = deadline_date.strftime('%Y-%m-%d')
        except Exception:
            deadline_str = check_in_str
            
    # Calculate data completeness confidence score
    confidence = 100
    email = str(booking.get('email', '')).strip()
    if not email or '@' not in email or '.' not in email:
        confidence -= 20
    phone = str(booking.get('phone', '')).strip()
    if not phone or len([c for c in phone if c.isdigit()]) < 7:
        confidence -= 15
    guest_name = str(booking.get('guest_name', '')).strip()
    if not guest_name or len(guest_name) < 3:
        confidence -= 15
    if not booking.get('payment_status'):
        confidence -= 15
    try:
        float(booking.get('amount', 0))
    except Exception:
        confidence -= 15
    if not check_in_str or not booking.get('check_out'):
        confidence -= 20
    confidence_score = max(10, confidence)
            
    return jsonify({
        'risk_level': risk_level,
        'risk_score': min(100, score), # Cap at 100
        'top_reason': top_reason,
        'recommended_action': recommended_action,
        'deadline': deadline_str,
        'confidence_score': confidence_score
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
