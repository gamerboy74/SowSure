import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  Image, 
  ListChecks,
  Settings,
  BarChart2,
  Bell
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Users, label: 'Farmers', path: '/admin/farmers' },
  { icon: ShoppingBag, label: 'Buyers', path: '/admin/buyers' },
  { icon: Image, label: 'Image Sliders', path: '/admin/sliders' },
  { icon: ListChecks, label: 'Featured Listings', path: '/admin/featured' },
  { icon: BarChart2, label: 'Analytics', path: '/admin/analytics' },
  { icon: Bell, label: 'Notifications', path: '/admin/notifications' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

function AdminSidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-white h-screen fixed left-0 top-0 shadow-lg">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-gray-800">FarmConnect Admin</h1>
      </div>
      <nav className="p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-5 w-5 mr-3" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default AdminSidebar;