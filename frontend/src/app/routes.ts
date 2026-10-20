import { createBrowserRouter, redirect } from 'react-router';
import Home from './pages/Home';
import StudentLogin from './pages/StudentLogin';
import AdminLogin from './pages/AdminLogin';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Developers from './pages/Developers';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/student/login',
    Component: StudentLogin,
  },
  {
    path: '/admin/login',
    Component: AdminLogin,
  },
  {
    path: '/student/dashboard',
    Component: StudentDashboard,
  },
  {
    path: '/admin/dashboard',
    Component: AdminDashboard,
  },
  {
    path: '/student/chatbot',
    loader: () => redirect('/student/dashboard'),
  },
  {
    path: '/developers',
    Component: Developers,
  },
]);
