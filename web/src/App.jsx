import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Shield, 
  Inbox, 
  Copy, 
  CheckCircle2, 
  Upload, 
  LogOut, 
  User, 
  ChevronDown, 
  AlertCircle, 
  X, 
  Check,
  TrendingUp,
  MapPin,
  Activity,
  BarChart3
} from 'lucide-react';

function formatDateRange(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '';
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return `${checkIn} - ${checkOut}`;
  
  const options1 = { month: 'short', day: 'numeric' };
  const options2 = { month: 'short', day: 'numeric', year: 'numeric' };
  
  if (d1.getFullYear() === d2.getFullYear()) {
    return `${d1.toLocaleDateString('en-US', options1)} - ${d2.toLocaleDateString('en-US', options2)}`;
  }
  return `${d1.toLocaleDateString('en-US', options2)} - ${d2.toLocaleDateString('en-US', options2)}`;
}

function formatSingleDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount) {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(parsed);
}

// Leaflet custom SVG marker creation helper (Offline-compliant)
const createCustomIcon = (color) => {
  return L.divIcon({
    html: `
      <div class="flex flex-col items-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" class="w-8 h-8 filter drop-shadow">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <div class="w-2 h-2 bg-black rounded-full mt-[-4px]"></div>
      </div>
    `,
    className: 'custom-leaflet-icon',
    iconSize: [32, 42],
    iconAnchor: [16, 42]
  });
};

// Map Component centered in Bihar, India
function NetworkMap({ navigate }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const hotels = [
    { name: "Patna Royal Palace", id: "SS-1042", coords: [25.5941, 85.1376], risk: "Low", color: "#6B7280" },
    { name: "Gaya Heritage Inn", id: "SS-1043", coords: [24.7914, 85.0002], risk: "Medium", color: "#F59E0B" },
    { name: "Rajgir Wellness Resort", id: "SS-1088", coords: [25.0300, 85.4170], risk: "High", color: "#EF4444" }
  ];

  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      // Center map on BiharCoordinates
      mapInstance.current = L.map(mapRef.current).setView([25.0961, 85.3131], 8);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      // Add markers
      hotels.forEach(h => {
        const icon = createCustomIcon(h.color);
        L.marker(h.coords, { icon })
          .addTo(mapInstance.current)
          .bindPopup(`
            <div class="p-2 font-sans">
              <span class="text-[10px] font-bold text-slate-400 block uppercase">Hotel ID: ${h.id}</span>
              <strong class="text-sm text-slate-900 block mt-0.5">${h.name}</strong>
              <span class="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase rounded mt-2 border ${
                h.risk === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                h.risk === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                'bg-slate-100 text-slate-700 border-slate-200'
              }">${h.risk} Risk</span>
            </div>
          `);
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-full rounded-xl overflow-hidden border border-slate-200 bg-white">
      {/* Left Map panel */}
      <div className="flex-1 relative bg-slate-100 min-h-[500px] lg:min-h-0 border-r border-slate-200">
        <div ref={mapRef} className="absolute inset-0 w-full h-full z-10" />
      </div>

      {/* Right Info sidebar */}
      <div className="w-full lg:w-96 bg-white p-6 shrink-0 flex flex-col justify-between overflow-y-auto z-20">
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Distance Check</h3>
          
          {/* Proximity Alert Card */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider">Proximity Alert</h4>
                <p className="text-xs text-red-700 font-medium mt-1 leading-normal">
                  2 properties found within 0.5 miles. High risk of duplicate check-ins.
                </p>
                <button 
                  onClick={() => navigate('/duplicates')}
                  className="mt-3 px-3 py-1.5 bg-black text-white hover:bg-slate-800 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors shadow-xs"
                >
                  Review Duplicates
                </button>
              </div>
            </div>
          </div>

          {/* My Hotels List */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">My Hotels</h3>
            {hotels.map(h => (
              <div key={h.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-slate-350 transition-colors">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">ID: {h.id}</span>
                  <strong className="text-xs font-bold text-slate-900 block mt-0.5">{h.name}</strong>
                  <span className="text-[10px] text-slate-500 mt-1 block">Bihar, India</span>
                </div>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: h.color }} title={`${h.risk} Risk`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Simple State Routing
  const [route, setRoute] = useState(window.location.pathname === '/' ? '/inbox' : window.location.pathname);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('stayshield_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState('owner@stayshield.com');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('Receptionist');
  const [regHotelId, setRegHotelId] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Data states
  const [hotels, setHotels] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [recoverySummary, setRecoverySummary] = useState({ totalRecovered: 0, bookings: [] });
  const [diagnostics, setDiagnostics] = useState({ ml_status: 'Offline', db_status: 'Unhealthy', logs: [] });
  const [analytics, setAnalytics] = useState({ demandForecast: [], cancellationProbabilities: [] });
  
  // UI states
  const [inboxFilter, setInboxFilter] = useState('All'); // 'All' | 'Open' | 'Resolved'
  const [inboxSort, setInboxSort] = useState('risk_score_desc'); // 'risk_score_desc' | 'id_desc'
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadHotelId, setUploadHotelId] = useState('');
  const [selectedHotelFilter, setSelectedHotelFilter] = useState('All');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Manual booking states
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualGuestName, setManualGuestName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualRoomType, setManualRoomType] = useState('Deluxe');
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPaymentStatus, setManualPaymentStatus] = useState('Unpaid');
  const [manualSourceChannel, setManualSourceChannel] = useState('Phone Call');
  const [manualHotelId, setManualHotelId] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');

  // Sync route state with address bar
  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname === '/' ? '/inbox' : window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState(null, '', path);
    setRoute(path);
  };

  // RBAC route guard
  useEffect(() => {
    if (user) {
      if (user.role === 'Receptionist' && !['/inbox', '/recovered'].includes(route)) {
        navigate('/inbox');
      } else if (user.role === 'Admin' && ['/map', '/analytics'].includes(route)) {
        navigate('/inbox');
      }
    }
  }, [route, user]);

  // Load hotels list for signup dropdown
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const res = await fetch('/api/hotels');
        if (res.ok) {
          const data = await res.json();
          setHotels(data);
          if (data.length > 0) setRegHotelId(data[0].id.toString());
        }
      } catch (err) {
        console.error('Error fetching hotels:', err);
      }
    };
    fetchHotels();
  }, []);

  // Request headers helper containing RBAC context
  const getAuthHeaders = () => {
    if (!user) return {};
    const headers = {
      'x-user-role': user.role,
      'x-user-hotel-id': user.hotel_id ? user.hotel_id.toString() : ''
    };
    if (user.role === 'Owner' && selectedHotelFilter !== 'All') {
      headers['x-user-hotel-id'] = selectedHotelFilter;
      headers['x-user-role'] = 'Admin';
    }
    return headers;
  };

  // Fetch functions
  const fetchBookings = async () => {
    try {
      const statusParam = inboxFilter === 'All' ? '' : `status=${inboxFilter}`;
      const sortParam = `sort=${inboxSort}`;
      const query = [statusParam, sortParam].filter(Boolean).join('&');
      
      const res = await fetch(`/api/bookings?${query}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  };

  const fetchDuplicates = async () => {
    try {
      const res = await fetch('/api/duplicates', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDuplicates(data);
      }
    } catch (err) {
      console.error('Error fetching duplicates:', err);
    }
  };

  const fetchRecoverySummary = async () => {
    try {
      const res = await fetch('/api/recovery-summary', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRecoverySummary(data);
      }
    } catch (err) {
      console.error('Error fetching recovery summary:', err);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch('/api/diagnostics/logs', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (err) {
      console.error('Error fetching diagnostics:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/demand-cancellation', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  // Trigger loads based on active route / filter / sort
  useEffect(() => {
    if (!user) return;
    if (route === '/inbox') {
      fetchBookings();
    } else if (route === '/duplicates') {
      fetchDuplicates();
    } else if (route === '/recovered') {
      fetchRecoverySummary();
    } else if (route === '/diagnostics') {
      fetchDiagnostics();
    } else if (route === '/analytics') {
      fetchAnalytics();
    }
  }, [route, user, inboxFilter, inboxSort, selectedHotelFilter]);

  // Diagnostics polling
  useEffect(() => {
    if (!user || route !== '/diagnostics') return;
    const interval = setInterval(fetchDiagnostics, 5000);
    return () => clearInterval(interval);
  }, [route, user]);

  // Auth Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('stayshield_user', JSON.stringify(data.user));
        setUser(data.user);
        navigate('/inbox');
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch (err) {
      setLoginError('Server connection error. Please try again.');
    }
  };

  // Registration Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const payload = {
      name: regName,
      email: regEmail,
      password: regPassword,
      role: regRole,
      hotel_id: regRole === 'Owner' ? null : parseInt(regHotelId)
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRegSuccess('Registration successful! Switch to Sign In to log in.');
        setRegName('');
        setRegEmail('');
        setRegPassword('');
      } else {
        setRegError(data.error || 'Registration failed.');
      }
    } catch (err) {
      setRegError('Server connection error. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stayshield_user');
    setUser(null);
  };

  // Toggle booking status
  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchBookings();
        if (newStatus === 'Resolved') {
          fetchDuplicates();
          fetchRecoverySummary();
        }
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Verify Guest (bulk resolve duplicates)
  const handleVerifyGuest = async (bookingIds) => {
    try {
      const res = await fetch('/api/bookings/bulk-resolve', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingIds })
      });
      if (res.ok) {
        fetchDuplicates();
        fetchBookings();
        fetchRecoverySummary();
      }
    } catch (err) {
      console.error('Error resolving duplicate cluster:', err);
    }
  };

  // Handle CSV file upload
  const handleCSVUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    const headers = {};
    if (user) {
      headers['x-user-role'] = user.role;
      headers['x-user-hotel-id'] = (user.role === 'Owner' && uploadHotelId) ? uploadHotelId : (user.hotel_id ? user.hotel_id.toString() : '');
    }

    try {
      const res = await fetch('/api/bookings/upload', {
        method: 'POST',
        headers: headers,
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadSuccess(`Successfully imported ${data.count} bookings.`);
        setUploadFile(null);
        fetchBookings();
        fetchDuplicates();
        fetchRecoverySummary();
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setUploadSuccess(null);
        }, 1500);
      } else {
        setUploadError(data.error || 'Failed to upload CSV file.');
      }
    } catch (err) {
      setUploadError('Failed to upload file. Check API server.');
    } finally {
      setUploading(false);
    }
  };

  // Manual booking submit
  const handleManualBookingSubmit = async (e) => {
    e.preventDefault();
    setManualError('');
    setManualSuccess('');

    const payload = {
      guest_name: manualGuestName,
      phone: manualPhone,
      email: manualEmail,
      room_type: manualRoomType,
      check_in: manualCheckIn,
      check_out: manualCheckOut,
      amount: parseFloat(manualAmount),
      payment_status: manualPaymentStatus,
      source_channel: manualSourceChannel,
      hotel_id: user.role === 'Owner' ? (manualHotelId ? parseInt(manualHotelId) : null) : user.hotel_id
    };

    try {
      const res = await fetch('/api/bookings/manual', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setManualSuccess('Booking successfully created!');
        setManualGuestName('');
        setManualPhone('');
        setManualEmail('');
        setManualRoomType('Deluxe');
        setManualCheckIn('');
        setManualCheckOut('');
        setManualAmount('');
        setManualPaymentStatus('Unpaid');
        setManualSourceChannel('Phone Call');
        
        fetchBookings();
        fetchDuplicates();
        fetchRecoverySummary();

        setTimeout(() => {
          setIsManualModalOpen(false);
          setManualSuccess('');
        }, 1500);
      } else {
        setManualError(data.error || 'Failed to create booking.');
      }
    } catch (err) {
      setManualError('Network error. Check connection to backend.');
    }
  };

  const handleDeleteAllBookings = async () => {
    if (!window.confirm("WARNING: Are you sure you want to delete all bookings? This action cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert("All bookings cleared successfully.");
        fetchBookings();
        fetchDuplicates();
        fetchRecoverySummary();
        fetchAnalytics();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete bookings");
      }
    } catch (err) {
      alert("Network error trying to clear bookings.");
    }
  };

  // Auth gate (Login or Register pages)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="h-12 w-12 bg-black rounded-xl flex items-center justify-center text-white mb-3">
                <Shield className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans uppercase">STAYSHIELD</h1>
              <p className="text-sm text-slate-500 mt-1">Multi-Tenant Hotel Risk Suite</p>
            </div>

            {/* Preseeded Logins Helper Card */}
            {!isRegistering && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-[10px] text-slate-600 mb-5 leading-normal space-y-1">
                <strong className="text-slate-950 font-bold block uppercase tracking-wider mb-1">Preseeded Test Accounts:</strong>
                <div>🏢 <strong>Owner:</strong> <code className="bg-slate-200/60 px-1 rounded text-black">owner@stayshield.com</code> / password123 (full views)</div>
                <div>💼 <strong>Admin:</strong> <code className="bg-slate-200/60 px-1 rounded text-black">admin@stayshield.com</code> / password123 (Patna hotel manager)</div>
                <div>🛎️ <strong>Receptionist:</strong> <code className="bg-slate-200/60 px-1 rounded text-black">receptionist@stayshield.com</code> / password123 (Patna front-desk)</div>
              </div>
            )}

            {isRegistering ? (
              // Signup screen
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest border-b pb-2">Create Account</h3>
                
                {regError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{regSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="name@hotel.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Privilege Role</label>
                  <select 
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs bg-white"
                  >
                    <option value="Receptionist">Receptionist (Limit: Upload/Resolved only)</option>
                    <option value="Admin">Admin (Access duplicates/diagnostics)</option>
                    <option value="Owner">Group Owner (See map, metrics, all hotels)</option>
                  </select>
                </div>

                {regRole !== 'Owner' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Assign to Hotel</label>
                    <select 
                      value={regHotelId}
                      onChange={(e) => setRegHotelId(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs bg-white"
                    >
                      {hotels.map(h => (
                        <option key={h.id} value={h.id}>{h.name} ({h.location})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="w-full py-2.5 px-4 bg-black text-white hover:bg-slate-800 font-medium rounded-lg text-sm transition-colors mt-2"
                >
                  Create Account
                </button>
              </form>
            ) : (
              // Login Screen
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                  <input 
                    type="email" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                    placeholder="user@stayshield.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-2.5 px-4 bg-black text-white hover:bg-slate-800 font-medium rounded-lg text-sm transition-colors mt-2"
                >
                  Sign In
                </button>
              </form>
            )}

            {/* Auth toggle footer */}
            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <button 
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setRegError('');
                  setRegSuccess('');
                  setLoginError('');
                }} 
                className="hover:text-black font-semibold uppercase tracking-wider"
              >
                {isRegistering ? 'Back to Sign In' : 'Register Account'}
              </button>
              <a href="#" className="hover:text-black">Forgot Password?</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard layouts
  return (
    <div className="min-h-screen flex bg-[#FAF9F9]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 px-6 border-b border-slate-200 flex items-center gap-3">
            <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center text-white">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-slate-900 text-lg uppercase block leading-none">STAYSHIELD</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5 block">Management</span>
            </div>
          </div>

          {/* Navigation Links (RBAC Filtered) */}
          <nav className="p-4 space-y-1">
            <button 
              onClick={() => navigate('/inbox')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                route === '/inbox' 
                  ? 'bg-slate-100 text-black' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-black'
              }`}
            >
              <Inbox className="h-4 w-4" />
              <span>Inbox</span>
            </button>

            {user.role !== 'Receptionist' && (
              <button 
                onClick={() => navigate('/duplicates')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  route === '/duplicates' 
                    ? 'bg-slate-100 text-black' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                }`}
              >
                <Copy className="h-4 w-4" />
                <span>Duplicates</span>
              </button>
            )}

            <button 
              onClick={() => navigate('/recovered')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                route === '/recovered' 
                  ? 'bg-slate-100 text-black' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-black'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Recovered</span>
            </button>

            {user.role === 'Owner' && (
              <>
                <button 
                  onClick={() => navigate('/map')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    route === '/map' 
                      ? 'bg-slate-100 text-black' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  <span>Network Map</span>
                </button>
                <button 
                  onClick={() => navigate('/analytics')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    route === '/analytics' 
                      ? 'bg-slate-100 text-black' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </button>
              </>
            )}

            {user.role !== 'Receptionist' && (
              <button 
                onClick={() => navigate('/diagnostics')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  route === '/diagnostics' 
                    ? 'bg-slate-100 text-black' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Diagnostics</span>
              </button>
            )}
          </nav>
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider text-left">Active Hotel Scope</span>
            {user.role === 'Owner' ? (
              <select
                value={selectedHotelFilter}
                onChange={(e) => setSelectedHotelFilter(e.target.value)}
                className="w-full mt-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
              >
                <option value="All">🏢 ALL BIHAR HOTELS</option>
                {hotels.map(h => (
                  <option key={h.id} value={h.id.toString()}>📍 {h.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-semibold text-slate-900 block truncate mt-1 text-left">
                📍 {user.hotel_name || 'My Hotel'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mb-3 border-t border-slate-200/60 pt-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold text-xs uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="max-w-[120px]">
                <span className="text-xs font-semibold text-slate-900 block truncate leading-tight">{user.name}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider mt-0.5">{user.role}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-xs font-medium rounded-lg text-slate-600 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {route === '/inbox' && (
          <div className="p-8 flex-1">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Inbox</h2>
                <p className="text-xs text-slate-500 mt-0.5">Booking Risk inbox</p>
              </div>
              <div className="flex items-center gap-3">
                {user.role !== 'Receptionist' && (
                  <button 
                    onClick={handleDeleteAllBookings}
                    className="flex items-center gap-2 px-4 py-2 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-lg transition-colors shadow-xs"
                  >
                    <span>Clear Data</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsManualModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-750 text-sm font-semibold rounded-lg transition-colors"
                >
                  <span>New Booking</span>
                </button>
                <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white hover:bg-slate-800 text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>CSV Upload</span>
                </button>
              </div>
            </div>

            {/* Filter & Sort Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              {/* Tab Filters */}
              <div className="flex items-center border border-slate-200 bg-white rounded-lg p-0.5">
                {['All', 'Open', 'Resolved'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setInboxFilter(filter)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      inboxFilter === filter
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-black hover:bg-slate-50'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Sorting Toggle */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Sort by:</span>
                <select
                  value={inboxSort}
                  onChange={(e) => setInboxSort(e.target.value)}
                  className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-black font-medium"
                >
                  <option value="risk_score_desc">Risk Score (High to Low)</option>
                  <option value="id_desc">Date Uploaded (Newest)</option>
                </select>
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Guest</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Dates</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Risk Details</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Reason</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Recommended Action</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Deadline</th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-slate-500 text-sm">
                        No bookings found. Try uploading a CSV or verify filter settings.
                      </td>
                    </tr>
                  ) : (
                    bookings.map((booking) => {
                      let riskBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                      if (booking.risk_level === 'High') {
                        riskBadgeColor = 'bg-red-50 text-red-700 border-red-200';
                      } else if (booking.risk_level === 'Medium') {
                        riskBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                      }

                      return (
                        <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-900 block leading-tight">{booking.guest_name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 leading-none">
                              {booking.email} • {booking.phone}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-600">
                            {formatDateRange(booking.check_in, booking.check_out)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase rounded-md border ${riskBadgeColor}`}>
                              {booking.risk_level} ({booking.risk_score})
                            </span>
                            {booking.confidence_score !== undefined && (
                              <span className="text-[9px] text-slate-400 block mt-1">
                                Confidence: {booking.confidence_score}%
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate" title={booking.top_reason}>
                            {booking.top_reason}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-700 font-medium max-w-xs">
                            {booking.recommended_action}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {formatSingleDate(booking.deadline)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="relative inline-block text-left">
                              <select
                                value={booking.status}
                                onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border focus:outline-none ${
                                  booking.status === 'Resolved' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : booking.status === 'Ignored'
                                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                    : 'bg-white text-slate-800 border-slate-200 focus:ring-1 focus:ring-black'
                                }`}
                              >
                                <option value="Open">Open</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Ignored">Ignored</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {route === '/duplicates' && user.role !== 'Receptionist' && (
          <div className="p-8 flex-1">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Active Duplicate Clusters</h2>
              <p className="text-xs text-slate-500 mt-0.5">Review potential overlaps and duplicate bookings across properties.</p>
            </div>

            {/* Clusters Grid */}
            {duplicates.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
                No active duplicate clusters found. All bookings are cleared.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {duplicates.map((cluster) => {
                  let riskBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (cluster.max_risk_level === 'High') {
                    riskBadgeColor = 'bg-red-50 text-red-700 border-red-200';
                  } else if (cluster.max_risk_level === 'Medium') {
                    riskBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  return (
                    <div key={cluster.cluster_id} className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 flex flex-col justify-between transition-shadow hover:shadow-sm">
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
                          <div>
                            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Cluster ID</span>
                            <h3 className="text-sm font-bold text-slate-900 mt-0.5">{cluster.cluster_id}</h3>
                          </div>
                          <span className={`inline-flex px-2 py-0.5 text-[9px] font-extrabold uppercase rounded border ${riskBadgeColor}`}>
                            {cluster.max_risk_level} Risk
                          </span>
                        </div>

                        {/* Details */}
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Involved Guests</span>
                            <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                              {cluster.involved_guests.join(', ')}
                            </span>
                          </div>

                          <div className="flex justify-between gap-4 border-t border-slate-50 pt-2.5">
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Bookings</span>
                              <span className="text-xs font-medium text-slate-800 mt-0.5 block">{cluster.total_rooms} Rooms</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Conflicting Dates</span>
                              <span className="text-xs font-medium text-slate-800 mt-0.5 block">{cluster.conflicting_dates}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Revenue Exposed</span>
                          <span className="text-lg font-extrabold text-slate-900 leading-none">
                            {formatCurrency(cluster.total_revenue)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleVerifyGuest(cluster.bookings.map(b => b.id))}
                          className="px-4 py-2 bg-black text-white hover:bg-slate-800 text-xs font-bold rounded-lg transition-colors shadow-xs"
                        >
                          Verify Guest
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {route === '/recovered' && (
          <div className="p-8 flex-1">
            {/* Header Summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Total Amount Recovered This Month</span>
                <h2 className="text-4xl font-extrabold text-slate-900 mt-2 font-sans tracking-tight">
                  {formatCurrency(recoverySummary.totalRecovered)}
                </h2>
                <span className="text-[10px] text-slate-400 block mt-2 font-medium">
                  💡 *Calculation:* Sum of booking amount for resolved medium/high-risk conflicts checking in this month.
                </span>
              </div>
              <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>

            {/* Resolved Table */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Recovered Bookings Log</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                      <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Guest</th>
                      <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Action Taken</th>
                      <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recoverySummary.bookings.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500 text-sm">
                          No resolved medium/high risk bookings for this calendar month.
                        </td>
                      </tr>
                    ) : (
                      recoverySummary.bookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-xs font-medium text-slate-600">
                            {formatSingleDate(booking.date)}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900">
                            {booking.guest}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                            {booking.action_taken}
                          </td>
                          <td className="px-6 py-4 text-right font-extrabold text-emerald-700 text-sm">
                            {formatCurrency(booking.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {route === '/map' && user.role === 'Owner' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="p-8 pb-4">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Network Map</h2>
              <p className="text-xs text-slate-500 mt-0.5">Bihar hotel group risk map view.</p>
            </div>
            {/* Map wrapper */}
            <div className="flex-1 min-h-[500px] p-8 pt-0">
              <NetworkMap navigate={navigate} />
            </div>
          </div>
        )}

        {route === '/analytics' && user.role === 'Owner' && (
          <div className="p-8 flex-1">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics Dashboard</h2>
                <p className="text-xs text-slate-500 mt-0.5">Destination Demand Forecasting & Cancellation Risk Probability metrics.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Destination Demand chart */}
              <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">Bihar Destination Demand Forecast (Next 7 Days)</h3>
                
                {/* Visual Chart with bars */}
                <div className="space-y-6">
                  {analytics.demandForecast.map((d, index) => {
                    const maxCount = 60;
                    const patnaPct = d.Patna !== undefined ? ((d.Patna || 0) / maxCount) * 100 : 0;
                    const gayaPct = d.Gaya !== undefined ? ((d.Gaya || 0) / maxCount) * 100 : 0;
                    const rajgirPct = d.Rajgir !== undefined ? ((d.Rajgir || 0) / maxCount) * 100 : 0;

                    return (
                      <div key={index} className="grid grid-cols-12 items-center gap-3">
                        <div className="col-span-2 text-xs font-semibold text-slate-500">{d.day}</div>
                        <div className="col-span-10 space-y-1.5">
                          {/* Patna */}
                          {d.Patna !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] w-12 font-bold text-slate-400">Patna:</span>
                              <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-slate-700 h-full rounded-full" style={{ width: `${patnaPct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-700">{d.Patna}</span>
                            </div>
                          )}
                          {/* Gaya */}
                          {d.Gaya !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] w-12 font-bold text-slate-400">Gaya:</span>
                              <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-amber-400 h-full rounded-full" style={{ width: `${gayaPct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-700">{d.Gaya}</span>
                            </div>
                          )}
                          {/* Rajgir */}
                          {d.Rajgir !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] w-12 font-bold text-slate-400">Rajgir:</span>
                              <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-red-400 h-full rounded-full" style={{ width: `${rajgirPct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-700">{d.Rajgir}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cancellation probability card deck */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Cancellation Probability Indexes</h3>
                {analytics.cancellationProbabilities.map((c, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hotel ID: {c.hotelId === 1 ? 'SS-1042' : c.hotelId === 2 ? 'SS-1043' : 'SS-1088'}</span>
                        <strong className="text-sm text-slate-900 block mt-0.5 leading-tight">{c.hotelName}</strong>
                      </div>
                      <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${
                        c.alert === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                        c.alert === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-slate-100 text-slate-700 border-slate-250'
                      }`}>{c.alert} Risk</span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Cancellation Rate</span>
                        <span className="text-2xl font-extrabold text-slate-900 block mt-1">{c.rate}%</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-medium">High Risk Bookings</span>
                        <span className="text-sm font-bold text-slate-850 block mt-1">{c.riskCount} active</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {route === '/diagnostics' && user.role !== 'Receptionist' && (
          <div className="p-8 flex-1">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Diagnostics</h2>
                <p className="text-xs text-slate-500 mt-0.5">ML Status, complete server logs, and offline testing checks.</p>
              </div>
              <button 
                onClick={fetchDiagnostics}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white hover:bg-slate-800 text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                <span>Reload Logs</span>
              </button>
            </div>

            {/* Diagnostics Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">ML Scorer Service</span>
                  <span className={`text-lg font-extrabold block mt-1.5 ${diagnostics.ml_status === 'Online' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {diagnostics.ml_status}
                  </span>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border ${
                  diagnostics.ml_status === 'Online' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-500'
                }`}>
                  <Activity className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Database Health</span>
                  <span className={`text-lg font-extrabold block mt-1.5 ${diagnostics.db_status === 'Healthy' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {diagnostics.db_status}
                  </span>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border ${
                  diagnostics.db_status === 'Healthy' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-500'
                }`}>
                  <Shield className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Offline Scorer Mode</span>
                  <span className="text-lg font-extrabold text-slate-900 block mt-1.5">
                    Deterministic Scorer
                  </span>
                </div>
                <div className="h-10 w-10 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg flex items-center justify-center shrink-0">
                  <Check className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Event Logs list */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Event Log</h3>
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Latest 100 System Actions</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {diagnostics.logs.length} Logged
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto font-mono text-[11px] p-4 space-y-2 bg-[#1E1E1E] text-white">
                    {diagnostics.logs.length === 0 ? (
                      <div className="text-slate-400 text-center py-8 font-sans">
                        No events logged yet. Try uploading a CSV or changing a status to generate logs.
                      </div>
                    ) : (
                      diagnostics.logs.map((log, i) => (
                        <div key={i} className="py-1.5 leading-relaxed break-all border-b border-zinc-800">
                          <span className="text-zinc-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                          <span className={`font-bold uppercase ${
                            log.type === 'ERROR' ? 'text-rose-500' :
                            log.type === 'ML_REQUEST' ? 'text-sky-400' :
                            log.type === 'ML_RESPONSE' ? 'text-purple-400' :
                            'text-amber-400'
                          }`}>[{log.type}]</span>{' '}
                          <span className="text-zinc-200">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Offline testing guide */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Offline Testing Guide</h3>
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    StayShield is designed to operate <strong>100% offline</strong> at runtime. You can test this by simulating internet disconnection:
                  </p>
                  
                  <div className="space-y-3 text-xs">
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-400">1.</span>
                      <p className="text-slate-600">Turn off your computer's internet adapter or Wi-Fi.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-400">2.</span>
                      <p className="text-slate-600">Upload the test file <code className="bg-slate-100 px-1 py-0.5 rounded">sample_bookings.csv</code> in the Inbox.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-400">3.</span>
                      <p className="text-slate-600">The ML Scorer will resolve pings in <strong>less than 5ms</strong> because it evaluates rules deterministically in local memory.</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 font-medium leading-relaxed">
                    Note: Since all Python scoring logic and Vite dependencies are compiled directly inside the Docker images, no remote lookups or API calls are ever triggered.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CSV Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Upload Bookings CSV</h3>
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadError(null);
                  setUploadSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCSVUpload} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {user.role === 'Owner' && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Select Destination Hotel *</label>
                  <select 
                    value={uploadHotelId}
                    onChange={(e) => setUploadHotelId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs bg-white"
                    required
                  >
                    <option value="">-- Choose Hotel --</option>
                    {hotels.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700">
                  {uploadFile ? uploadFile.name : 'Click to select CSV File'}
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  Expected columns: guest_name, phone, email, room_type, check_in, check_out, amount, payment_status, source_channel, booking_date
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadFile(null);
                    setUploadError(null);
                    setUploadSuccess(null);
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg text-slate-700 transition-colors"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white hover:bg-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-xs disabled:bg-slate-400"
                  disabled={!uploadFile || uploading}
                >
                  {uploading ? 'Processing...' : 'Upload & Parse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Booking Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Add New Booking</h3>
              <button 
                onClick={() => {
                  setIsManualModalOpen(false);
                  setManualError('');
                  setManualSuccess('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleManualBookingSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {manualError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              {manualSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{manualSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Guest Name *</label>
                  <input 
                    type="text" 
                    value={manualGuestName}
                    onChange={(e) => setManualGuestName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="Guest Full Name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone</label>
                  <input 
                    type="text" 
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="+1 555-0199"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                  <input 
                    type="email" 
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="guest@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Room Type *</label>
                  <input 
                    type="text" 
                    value={manualRoomType}
                    onChange={(e) => setManualRoomType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="e.g. Deluxe, Standard"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Booking Amount (INR) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    placeholder="250.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Check-in Date *</label>
                  <input 
                    type="date" 
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Check-out Date *</label>
                  <input 
                    type="date" 
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Payment Status *</label>
                  <select 
                    value={manualPaymentStatus}
                    onChange={(e) => setManualPaymentStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs bg-white"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Source Channel *</label>
                  <select 
                    value={manualSourceChannel}
                    onChange={(e) => setManualSourceChannel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs bg-white"
                  >
                    <option value="Phone Call">Phone Call</option>
                    <option value="Direct Email">Direct Email</option>
                    <option value="Walk-in">Walk-in</option>
                  </select>
                </div>

                {user.role === 'Owner' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Assign to Hotel *</label>
                    <select 
                      value={manualHotelId}
                      onChange={(e) => setManualHotelId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-xs bg-white"
                      required
                    >
                      <option value="">-- Choose Hotel --</option>
                      {hotels.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsManualModalOpen(false);
                    setManualError('');
                    setManualSuccess('');
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white hover:bg-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
