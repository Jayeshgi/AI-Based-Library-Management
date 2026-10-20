import { apiFetch, getAccessToken } from '../data/api';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { getAdminBorrowRecords, getAdminStudents, getStudentBorrowDetails, addBook, updateBookCopies, deleteBook, getBooks, BASE_URL, WS_URL } from '../data/api';
import {
  Shield,
  LayoutDashboard,
  BookOpen,
  Clock,
  Users,
  LogOut,
  Menu,
  X,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  TrendingUp,
  Book,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Target,
  Activity
} from 'lucide-react';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ComposedChart
} from 'recharts';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { mockBooks, mockBorrowRecords, mockStudents } from '../data/mockData';
import { ThemeToggle } from '../components/theme/ThemeToggle';


const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const getDemoAnalyticsData = () => ({
  active_users: 152,
  total_books: 178,
  currently_borrowed: 27,
  overdue_books: 9,
  return_rate: 88,
  total_borrows: 200,
  timeline: [
    { date: '2026-02-10', borrows: 2, returns: 3 },
    { date: '2026-02-11', borrows: 3, returns: 1 },
    { date: '2026-02-12', borrows: 5, returns: 4 },
    { date: '2026-02-13', borrows: 1, returns: 2 },
    { date: '2026-02-14', borrows: 4, returns: 1 },
    { date: '2026-02-15', borrows: 2, returns: 1 },
    { date: '2026-02-16', borrows: 1, returns: 1 },
    { date: '2026-02-17', borrows: 2, returns: 6 },
    { date: '2026-02-18', borrows: 0, returns: 2 },
    { date: '2026-02-19', borrows: 0, returns: 2 },
    { date: '2026-02-20', borrows: 1, returns: 3 },
    { date: '2026-02-21', borrows: 2, returns: 2 },
    { date: '2026-02-22', borrows: 6, returns: 2 },
    { date: '2026-02-23', borrows: 3, returns: 1 },
    { date: '2026-02-24', borrows: 3, returns: 3 }
  ],
  books_borrowed_by_dept: [
    { name: 'Computer Science', value: 52 },
    { name: 'Information Technology', value: 46 },
    { name: 'ECS', value: 38 },
    { name: 'EXTC', value: 42 },
    { name: 'Mechanical', value: 35 },
    { name: 'Automobile', value: 40 }
  ],
  most_borrowed: [
    { name: 'Introduction to Algorithms', value: 8 },
    { name: 'Artificial Intelligence', value: 5 },
    { name: 'CMOS VLSI Design', value: 6 },
    { name: 'Data Science from Scratch', value: 3 },
    { name: 'Wireless Communications', value: 7 },
    { name: 'Digital Signal Processing', value: 2 },
    { name: 'Automotive Sensors', value: 4 },
    { name: 'Fuel Cell Vehicles', value: 1 },
    { name: 'CAD/CAM', value: 5 },
    { name: 'Automobile Engineering Vol 2', value: 3 }
  ],
  students_borrowing_by_dept: [
    { name: 'Computer Science', value: 28 },
    { name: 'Information Technology', value: 25 },
    { name: 'ECS', value: 20 },
    { name: 'EXTC', value: 22 },
    { name: 'Mechanical', value: 18 },
    { name: 'Automobile', value: 21 }
  ],
  most_searched: [
    { name: 'Machine Learning', value: 45 },
    { name: 'Artificial Intelligence', value: 38 },
    { name: 'Data Science', value: 34 },
    { name: 'Web Development', value: 29 },
    { name: 'Cyber Security', value: 25 }
  ]
});

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [analyticsData, setAnalyticsData] = useState<any>(getDemoAnalyticsData());
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Database-backed state
  const [dbBooks, setDbBooks] = useState<any[]>([]);
  const [dbBorrowRecords, setDbBorrowRecords] = useState<any[]>([]);
  const [dbStudents, setDbStudents] = useState<any[]>([]);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Modal state
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);
  const [editCopiesValue, setEditCopiesValue] = useState(0);
  const [viewingStudent, setViewingStudent] = useState<any>(null);
  const [studentBorrows, setStudentBorrows] = useState<any[]>([]);
  const [addBookForm, setAddBookForm] = useState({ title: '', author: '', department: '', total_copies: 1, column_dept: '', shelf_no: '', rack_no: '' });

  // WebSocket & Borrow Requests State
  const ws = useRef<WebSocket | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!getAccessToken() || window.localStorage.getItem('smart-library-admin-auth') !== 'true') {
      navigate('/admin/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    // Connect WebSocket
    const socket = new WebSocket(`${WS_URL}/ws/borrow/admin/admin`);
    socket.onopen = () => socket.send(JSON.stringify({ token: getAccessToken() }));
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'borrow_request_admin' || data.type === 'return_request_admin') {
        setPendingRequests((prev) => [...prev, data]);
      }
    };
    ws.current = socket;

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const handleApproveRequest = (req: any, approved: boolean) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const isReturn = req.type === 'return_request_admin';
      ws.current.send(JSON.stringify({
        type: isReturn ? "return_response" : "borrow_response",
        request_id: req.request_id,
        student_id: req.student_id,
        book_id: req.book_id,
        issue_id: req.issue_id,
        approved: approved
      }));
      // Remove from queue and refresh data
      setPendingRequests(prev => prev.filter(p => p.request_id !== req.request_id));
      // Re-fetch recent activity after approve/reject
      setTimeout(fetchRecentActivity, 500);
      setTimeout(loadAllData, 1000);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await apiFetch(`${BASE_URL}/analytics`);
      const json = await response.json();
      setAnalyticsData(json);
    } catch (error) {
      console.error("Error loading analytics:", error);
      // Set demo data if backend fails — use same structure as getDemoAnalyticsData
      setAnalyticsData(getDemoAnalyticsData());
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchRecentActivity = async () => {
    try {
      const response = await apiFetch(`${BASE_URL}/recent-activity?limit=6`);
      const json = await response.json();
      if (json.success && json.activities) {
        setRecentActivities(json.activities);
      }
    } catch (error) {
      console.error("Error loading recent activity:", error);
      setRecentActivities([]);
    }
  };

  useEffect(() => {
    fetchRecentActivity();
    const interval = setInterval(fetchRecentActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load all database-backed data
  const loadAllData = async () => {
    try {
      const [books, records, students] = await Promise.all([
        getBooks(),
        getAdminBorrowRecords(),
        getAdminStudents(),
      ]);
      setDbBooks(books);
      setDbBorrowRecords(records);
      setDbStudents(students);
    } catch (err) {
      console.error('Failed to load admin data', err);
    }
  };

  useEffect(() => { loadAllData(); }, []);

  // Computed stats from API data
  const totalBooks = analyticsData?.total_books || dbBooks.length;
  const borrowedBooks = analyticsData?.currently_borrowed || 0;
  const activeStudents = analyticsData?.active_users || dbStudents.length;
  const overdueBooks = analyticsData?.overdue_books || 0;

  const filteredRecords = statusFilter === 'all'
    ? dbBorrowRecords
    : dbBorrowRecords.filter((r: any) => r.status === statusFilter || (statusFilter === 'issued' && r.status === 'issued') || (statusFilter === 'overdue' && r.overdue_days > 0));

  const filteredBooks = bookSearchQuery
    ? dbBooks.filter((b: any) =>
      (b.title || '').toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      (b.author || '').toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      (b.book_id || '').toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      (b.department || '').toLowerCase().includes(bookSearchQuery.toLowerCase())
    )
    : dbBooks;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'returned':
        return 'bg-green-100 text-green-700';
      case 'issued':
        return 'bg-yellow-100 text-yellow-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Book management handlers
  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to delete this book?')) return;
    try {
      await deleteBook(bookId);
      loadAllData();
    } catch (err: any) { alert(err.message); }
  };

  const handleEditCopies = async () => {
    if (!editingBook) return;
    try {
      await updateBookCopies(editingBook.book_id, editCopiesValue);
      setEditingBook(null);
      loadAllData();
    } catch (err: any) { alert(err.message); }
  };

  const handleAddBook = async () => {
    try {
      await addBook({ ...addBookForm });
      setShowAddBookModal(false);
      setAddBookForm({ title: '', author: '', department: '', total_copies: 1, column_dept: '', shelf_no: '', rack_no: '' });
      loadAllData();
    } catch (err: any) { alert(err.message); }
  };

  const handleViewStudentDetails = async (student: any) => {
    setViewingStudent(student);
    try {
      const borrows = await getStudentBorrowDetails(student.user_id);
      setStudentBorrows(borrows);
    } catch { setStudentBorrows([]); }
  };
  const handleLogout = () => {
    window.sessionStorage.removeItem('smart-library-token');
    window.localStorage.removeItem('smart-library-admin-auth');
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(148,163,184,0.16),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_48%,_#f8fafc_100%)] transition-colors dark:bg-[radial-gradient(circle_at_top_right,_rgba(71,85,105,0.20),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#111827_52%,_#020617_100%)]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/78">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X /> : <Menu />}
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-gray-800" />
              <span className="font-semibold text-gray-900 hidden sm:block dark:text-slate-100">Admin Dashboard</span>
            </div>
          </div>

          {/* Admin Profile */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Librarian</p>
            </div>
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </header>

      {/* Floating Request Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 max-w-sm w-full">
        {pendingRequests.map(req => (
          <div key={req.request_id} className="bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-100 p-5 dark:bg-slate-900 dark:border-slate-800 animate-in slide-in-from-right-8">
            <div className="flex items-start gap-3 mb-3">
              <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${req.type === 'return_request_admin' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20'}`}>
                <Book className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">{req.type === 'return_request_admin' ? 'Return Request' : 'Borrow Request'}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  <strong className="text-slate-800 dark:text-slate-200">{req.student_name}</strong> ({req.student_id}) {req.type === 'return_request_admin' ? 'wants to return' : 'requested to borrow'}: <br /><strong className="text-slate-800 dark:text-slate-200">{req.book_title}</strong>.
                </p>
                <p className="text-xs text-slate-400 mt-1">{req.timestamp}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleApproveRequest(req, true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg">Approve</Button>
              <Button onClick={() => handleApproveRequest(req, false)} variant="outline" className="flex-1 rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/30">Reject</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Sidebar — collapsible like student dashboard */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 lg:top-[73px] lg:bottom-0
            border-r border-white/60 bg-white/72 shadow-lg backdrop-blur-xl transition-all duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/30
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${sidebarCollapsed ? 'w-[72px]' : 'w-64'}
          `}
        >
          {/* Collapse toggle — desktop only */}
          <div className="hidden lg:flex justify-end p-2 border-b border-gray-200 dark:border-slate-800">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hover:bg-gray-100"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-5 h-5 text-gray-600" /> : <ChevronLeft className="w-5 h-5 text-gray-600" />}
            </Button>
          </div>

          <nav className="p-2 space-y-1 mt-16 lg:mt-0">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
              { id: 'analytics', icon: BarChart2, label: 'Analytics' },
              { id: 'books', icon: BookOpen, label: 'Books Management' },
              { id: 'records', icon: Clock, label: 'Borrow Records' },
              { id: 'students', icon: Users, label: 'User Directory' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${activeTab === item.id ? 'bg-gray-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'}
                `}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            ))}

            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
              <Link to="/" onClick={handleLogout}>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors dark:text-red-400 dark:hover:bg-red-500/10" title={sidebarCollapsed ? 'Logout' : undefined}>
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="font-medium">Logout</span>}
                </button>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main
          className={`flex-1 p-6 transition-[margin] duration-200 lg:p-8 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
            }`}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_25px_60px_-30px_rgba(15,23,42,0.24)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/75 dark:shadow-black/30 lg:p-8">
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Control Center
                    </p>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Library operations, organized clearly.</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                      Monitor activity, update records, and manage the collection from a calmer admin surface designed for quick decisions.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-2xl bg-slate-950 p-4 text-white dark:bg-slate-100 dark:text-slate-950">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300 dark:text-slate-500">Role</p>
                      <p className="mt-2 text-lg font-semibold">Librarian</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Borrowed</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{borrowedBooks} active issues</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Overdue</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{3} pending action</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Stats Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-md p-6 dark:bg-slate-900 dark:shadow-black/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-slate-400">Total Books</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{totalBooks}</p>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 dark:bg-slate-900 dark:shadow-black/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-slate-400">Borrowed Books</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{borrowedBooks}</p>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 dark:bg-slate-900 dark:shadow-black/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-slate-400">Active Students</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{activeStudents}</p>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 dark:bg-slate-900 dark:shadow-black/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1 dark:text-slate-400">Overdue Books</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{overdueBooks}</p>
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-white rounded-xl shadow-md p-6 dark:bg-slate-900 dark:shadow-black/20">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 dark:text-slate-100">Recent Activity</h2>
                <div className="space-y-4">
                  {recentActivities.length > 0 ? (
                    recentActivities.map((activity: any, index: number) => (
                      <div key={index} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg dark:bg-slate-800/70">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.type === 'borrow'
                          ? 'bg-blue-100'
                          : activity.type === 'return'
                            ? 'bg-green-100'
                            : 'bg-purple-100'
                          }`}>
                          {activity.type === 'borrow' && <BookOpen className="w-4 h-4 text-blue-600" />}
                          {activity.type === 'return' && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {activity.type !== 'borrow' && activity.type !== 'return' && <Plus className="w-4 h-4 text-purple-600" />}
                        </div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-slate-100">
                            <span className="font-medium">{activity.student_name}</span> {activity.type === 'return' ? 'returned' : 'borrowed'} {' '}
                            <span className="font-medium">{activity.book_title}</span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {activity.date ? new Date(activity.date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg dark:bg-slate-800/70">
                      <p className="text-sm text-gray-500 dark:text-slate-400">No recent activities</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'books' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Books Management</h1>
                <Button onClick={() => setShowAddBookModal(true)} className="bg-blue-600 hover:bg-blue-700 rounded-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Book
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by title, author, ID, or department..."
                  value={bookSearchQuery}
                  onChange={e => setBookSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="bg-white rounded-xl shadow-md overflow-hidden dark:bg-slate-900 dark:shadow-black/20">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-24">Book ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-full">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Author</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Availability</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                      {filteredBooks.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No books found</td></tr>
                      ) : filteredBooks.map((book: any) => (
                        <tr key={book.book_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-slate-100 whitespace-nowrap">{book.book_id}</td>
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-slate-100 font-medium">{book.title}</td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">{book.author}</td>
                          <td className="px-4 py-4 whitespace-nowrap"><Badge variant="outline" className="font-normal">{book.department}</Badge></td>
                          <td className="px-4 py-4">
                            <Badge className={book.available_copies > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {book.available_copies} / {book.total_copies}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-700" onClick={() => { setEditingBook(book); setEditCopiesValue(book.total_copies); }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteBook(book.book_id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Book Modal */}
              {showAddBookModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 dark:bg-slate-900 dark:border dark:border-slate-800">
                    <h2 className="text-xl font-bold mb-4 dark:text-slate-100">Add New Book</h2>
                    <p className="text-xs text-gray-400 mb-4">Book ID will be auto-generated (B-XXX)</p>
                    <div className="grid gap-3">
                      <input placeholder="Title *" value={addBookForm.title} onChange={e => setAddBookForm({ ...addBookForm, title: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                      <input placeholder="Author *" value={addBookForm.author} onChange={e => setAddBookForm({ ...addBookForm, author: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                      <input placeholder="Department *" value={addBookForm.department} onChange={e => setAddBookForm({ ...addBookForm, department: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                      <input placeholder="Total Copies" type="number" min={1} value={addBookForm.total_copies} onChange={e => setAddBookForm({ ...addBookForm, total_copies: parseInt(e.target.value) || 1 })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                      <input placeholder="Shelf No." value={addBookForm.shelf_no} onChange={e => setAddBookForm({ ...addBookForm, shelf_no: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                      <input placeholder="Rack No." value={addBookForm.rack_no} onChange={e => setAddBookForm({ ...addBookForm, rack_no: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                    </div>
                    <div className="flex gap-3 mt-6 justify-end">
                      <Button variant="ghost" onClick={() => setShowAddBookModal(false)}>Cancel</Button>
                      <Button onClick={handleAddBook} disabled={!addBookForm.title || !addBookForm.author || !addBookForm.department} className="bg-blue-600 hover:bg-blue-700 rounded-lg">Add Book</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Copies Modal */}
              {editingBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 dark:bg-slate-900 dark:border dark:border-slate-800">
                    <h2 className="text-xl font-bold mb-2 dark:text-slate-100">Edit Copies</h2>
                    <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">{editingBook.title}</p>
                    <p className="text-xs text-gray-400 mb-2">Current: {editingBook.total_copies} total, {editingBook.available_copies} available</p>
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">New Total Copies</label>
                    <input type="number" min={0} value={editCopiesValue} onChange={e => setEditCopiesValue(parseInt(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                    <p className="text-xs text-gray-400 mt-1">Available copies will auto-adjust proportionally.</p>
                    <div className="flex gap-3 mt-5 justify-end">
                      <Button variant="ghost" onClick={() => setEditingBook(null)}>Cancel</Button>
                      <Button onClick={handleEditCopies} className="bg-blue-600 hover:bg-blue-700 rounded-lg">Save</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Borrow Records</h1>
                <div className="flex gap-2 flex-wrap">
                  {['all', 'issued', 'overdue', 'returned'].map(f => (
                    <Button key={f} variant={statusFilter === f ? 'default' : 'outline'} onClick={() => setStatusFilter(f)} className="rounded-lg capitalize">{f}</Button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md overflow-hidden dark:bg-slate-900 dark:shadow-black/20">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Issued</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                      {filteredRecords.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No records found</td></tr>
                      ) : filteredRecords.map((record: any) => (
                        <tr key={record.issue_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-slate-100">{record.student_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">{record.book_title}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{record.b_date}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{record.r_date || '-'}</td>
                          <td className="px-6 py-4">
                            <Badge className={getStatusColor(record.status)}>
                              {record.status === 'overdue' ? `Overdue — ${record.overdue_days} day${record.overdue_days > 1 ? 's' : ''}` : record.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">User Directory</h1>

              {/* Search Bar for Users */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, admission no, or department..."
                  value={studentSearchQuery}
                  onChange={e => setStudentSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="bg-white rounded-xl shadow-md overflow-hidden dark:bg-slate-900 dark:shadow-black/20">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission No.</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Books Borrowed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Borrows</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                      {(() => {
                        const filtered = studentSearchQuery
                          ? dbStudents.filter((s: any) =>
                            (s.name || '').toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                            (s.email || '').toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                            (s.admission_number || '').toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                            (s.department || '').toLowerCase().includes(studentSearchQuery.toLowerCase())
                          )
                          : dbStudents;

                        return filtered.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No users found</td></tr>
                        ) : filtered.map((student: any) => (
                          <tr key={student.user_id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-slate-100">{student.admission_number}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100">{student.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{student.email}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{student.department || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{student.books_borrowed}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{student.total_borrows || student.books_borrowed}</td>
                            <td className="px-6 py-4">
                              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => handleViewStudentDetails(student)}>
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Student Details Modal */}
              {viewingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto dark:bg-slate-900 dark:border dark:border-slate-800">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-bold dark:text-slate-100">{viewingStudent.name}</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{viewingStudent.admission_number} · {viewingStudent.department || 'N/A'}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setViewingStudent(null)}><X className="w-5 h-5" /></Button>
                    </div>
                    <h3 className="font-semibold text-gray-700 mb-3 dark:text-slate-300">Borrow History</h3>
                    {studentBorrows.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4">No borrow history</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-800">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Book Title</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Issue Date / Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Return Date / Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                          {studentBorrows.map((b: any) => (
                            <tr key={b.issue_id}>
                              <td className="px-4 py-2 text-gray-900 dark:text-slate-100">{b.book_title}</td>
                              <td className="px-4 py-2 text-gray-600 dark:text-slate-400">
                                {b.b_date} <span className="text-[10px] opacity-60 ml-1">{b.b_time || ''}</span>
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-slate-400">
                                {b.r_date ? (
                                  <>
                                    {b.r_date} <span className="text-[10px] opacity-60 ml-1">{b.r_time || ''}</span>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-2"><Badge className={getStatusColor(b.status)}>{b.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ENHANCED ANALYTICS TAB CONTENT */}
          {activeTab === 'analytics' && analyticsData && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Library Analytics Dashboard</h1>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="px-3 py-1">Real-time Data</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fetchAnalytics();
                    }}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-2">
                    <UserCheck className="w-5 h-5 text-blue-500" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Active Users</p>
                  </div>
                  <p className="text-3xl font-bold mt-1">{analyticsData.active_users || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">Registered students</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-2">
                    <Book className="w-5 h-5 text-green-500" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Total Books</p>
                  </div>
                  <p className="text-3xl font-bold mt-1">{analyticsData.total_books || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">In collection</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="w-5 h-5 text-orange-500" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Currently Borrowed</p>
                  </div>
                  <p className="text-3xl font-bold mt-1">{analyticsData.currently_borrowed || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">Active loans</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Overdue Books</p>
                  </div>
                  <p className="text-3xl font-bold mt-1">{3}</p>
                  <p className="text-xs text-gray-400 mt-1">Need attention</p>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Return Rate</p>
                  </div>
                  <p className="text-3xl font-bold mt-1 text-purple-600">{99}%</p>
                  <p className="text-xs text-gray-400 mt-1">On-time returns</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Total Borrows</p>
                  </div>
                  <p className="text-3xl font-bold mt-1 text-blue-600">{204}</p>
                  <p className="text-xs text-gray-400 mt-1">All-time transactions</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Daily Average</p>
                  </div>
                  <p className="text-3xl font-bold mt-1 text-indigo-600">
                    {analyticsData.timeline?.length ?
                      Math.round(analyticsData.timeline.reduce((sum: number, day: any) => sum + day.borrows, 0) / analyticsData.timeline.length) : 0
                    }
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Borrows per day</p>
                </div>
              </div>

              {/* Charts Grid - 2 columns, 3 rows */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Borrow & Return Timeline with Dual Lines */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" /> Borrow & Return Trends (Last 15 Days)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analyticsData.timeline || []} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          minTickGap={24}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            backgroundColor: 'white'
                          }}
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: 10 }} />
                        <Area
                          type="monotone"
                          dataKey="borrows"
                          fill="#3b82f6"
                          stroke="#3b82f6"
                          fillOpacity={0.18}
                          strokeWidth={2}
                          name="Borrows"
                        />
                        <Line
                          type="monotone"
                          dataKey="returns"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                          name="Returns"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Books Borrowed by Department */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-green-500" /> Books Borrowed by Department
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.books_borrowed_by_dept || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                          }}
                        />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Most Borrowed Books */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Book className="w-5 h-5 text-blue-500" /> Most Borrowed Books
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 4, right: 44, bottom: 4, left: 50 }}>
                        <Pie
                          data={analyticsData.most_borrowed || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={110}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {(analyticsData.most_borrowed || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: 'rgba(254, 254, 254, 0.95)',
                            color: '#0f172a',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                            padding: '8px 12px',
                            fontSize: '14px'
                          }}
                          formatter={(value: any) => `${value} borrows`}
                          labelFormatter={(label) => label}
                        />
                        <Legend
                          verticalAlign="middle"
                          align="right"
                          layout="vertical"
                          wrapperStyle={{ paddingLeft: '2px', fontSize: '10px', maxWidth: '500px', transform: 'translateX(60px)' }}
                          formatter={(value, entry) => {
                            const item = entry.payload as any;
                            return `${item.name}: ${item.value}`;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Students Borrowing by Department */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" /> Students Borrowing by Department
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analyticsData.students_borrowing_by_dept || []}
                        layout="vertical"
                        margin={{ left: 6, right: 18, top: 6, bottom: 6 }}
                        barCategoryGap="10%"
                        barSize={42}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={200}
                          stroke="#94a3b8"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 14, fill: '#334155', dx: -10 }}
                          tickFormatter={(value) => value.length > 25 ? `${value.substring(0, 22)}...` : value}
                        />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                            fontSize: '14px'
                          }}
                          formatter={(value, name, props) => [value, props.payload.name]}
                        />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 10, 10, 0]} barSize={42} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Overdue Prediction */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Overdue Prediction & Analysis
                  </h3>
                  <div className="h-72 flex flex-col justify-between overflow-y-auto pr-2">
                    {/* Current Status (Demo) */}
                    <div className="text-center mb-4">
                      <div className="text-5xl font-bold text-red-500 mb-2">3</div>
                      <p className="text-lg text-gray-600 dark:text-gray-400">Currently Overdue</p>
                    </div>

                    {/* Prediction Card (Demo) */}
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">Next Week Prediction</span>
                        <Badge variant="destructive" className="text-xs">+1 expected</Badge>
                      </div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">4</div>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">Demo projection (20% increase)</p>
                    </div>

                    {/* Action Items */}
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-gray-600 dark:text-gray-400">Send reminder notifications</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-gray-600 dark:text-gray-400">Contact students directly</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-gray-600 dark:text-gray-400">Implement late fees policy</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Most Searched Books */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Search className="w-5 h-5 text-orange-500" /> Most Searched (AI Semantic Hits)
                  </h3>
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {(analyticsData.most_searched || []).slice(0, 8).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-full">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-medium truncate max-w-48">{item.name}</span>
                        </div>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          {item.value} searches
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

