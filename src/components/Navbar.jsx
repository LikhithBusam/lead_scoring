import { useState } from 'react'
import {
    Building2, ChevronDown, LogOut, Settings, RefreshCw,
    Users, Globe, BarChart3, Bell
} from 'lucide-react'

const Navbar = ({
    currentCompany,
    onSwitchCompany,
    onLogout,
    lastUpdate,
    isPolling,
    onTogglePolling
}) => {
    const [showCompanyMenu, setShowCompanyMenu] = useState(false)

    const getPlanColor = (plan) => {
        switch (plan) {
            case 'enterprise': return 'bg-purple-100 text-purple-800'
            case 'pro': return 'bg-blue-100 text-blue-800'
            case 'basic': return 'bg-green-100 text-green-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Left side - Logo & Company */}
                    <div className="flex items-center gap-6">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-bold text-gray-900">Lead Scoring</span>
                        </div>

                        {/* Company Switcher */}
                        <div className="relative">
                            <button
                                onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                                className="flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                            >
                                <Building2 className="h-4 w-4 text-gray-500" />
                                <div className="text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 text-sm">
                                            {currentCompany?.company_name || 'Select Company'}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPlanColor(currentCompany?.plan_type)}`}>
                                            {currentCompany?.plan_type?.toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        ID: {currentCompany?.tenant_id?.substring(0, 8)}...
                                    </span>
                                </div>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCompanyMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {showCompanyMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowCompanyMenu(false)}
                                    />
                                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-20">
                                        {/* Current Company Info */}
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Company</p>
                                            <p className="font-medium text-gray-900">{currentCompany?.company_name}</p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {currentCompany?.stats?.leads || 0} leads
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Globe className="h-3 w-3" />
                                                    {currentCompany?.stats?.websites || 0} websites
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="py-1">
                                            <button
                                                onClick={() => {
                                                    setShowCompanyMenu(false)
                                                    onSwitchCompany()
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                            >
                                                <RefreshCw className="h-4 w-4 text-gray-400" />
                                                Switch Company
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowCompanyMenu(false)
                                                    onLogout()
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                                            >
                                                <LogOut className="h-4 w-4" />
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right side - Status & Actions */}
                    <div className="flex items-center gap-4">
                        {/* Last Update */}
                        {lastUpdate && (
                            <div className="text-xs text-gray-500 hidden sm:block">
                                Last updated: {lastUpdate.toLocaleTimeString()}
                            </div>
                        )}

                        {/* Live/Paused Toggle */}
                        <button
                            onClick={onTogglePolling}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${isPolling
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            {isPolling ? 'Live' : 'Paused'}
                        </button>

                        {/* Notifications (placeholder) */}
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navbar
