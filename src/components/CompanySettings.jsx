import { useState, useEffect } from 'react'
import {
    Building2, Key, Copy, RefreshCw, Save, Globe,
    BarChart3, Shield, Bell, CreditCard, Check,
    AlertTriangle, Eye, EyeOff
} from 'lucide-react'

const CompanySettings = ({ company, apiKey, onCompanyUpdate }) => {
    const [settings, setSettings] = useState({
        company_name: company?.company_name || '',
        domain: company?.domain || '',
        webhook_url: company?.webhook_url || ''
    })
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [showApiKey, setShowApiKey] = useState(false)
    const [usage, setUsage] = useState(null)
    const [loadingUsage, setLoadingUsage] = useState(true)

    // Fetch usage stats
    useEffect(() => {
        fetchUsage()
    }, [])

    const fetchUsage = async () => {
        try {
            const response = await fetch('/api/v1/tenants/me', {
                headers: { 'X-API-Key': apiKey }
            })
            const data = await response.json()
            if (data.success) {
                setUsage(data.tenant.stats)
            }
        } catch (error) {
            console.error('Error fetching usage:', error)
        } finally {
            setLoadingUsage(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setMessage(null)

        try {
            const response = await fetch('/api/v1/tenants/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(settings)
            })
            const data = await response.json()

            if (data.success) {
                setMessage({ type: 'success', text: 'Settings saved successfully!' })
                onCompanyUpdate(data.tenant)
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setSaving(false)
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        setMessage({ type: 'success', text: 'Copied to clipboard!' })
        setTimeout(() => setMessage(null), 2000)
    }

    const getPlanLimits = (plan) => {
        switch (plan) {
            case 'enterprise': return { websites: 'Unlimited', leads: 'Unlimited', apiCalls: 'Unlimited' }
            case 'pro': return { websites: 10, leads: 50000, apiCalls: 100000 }
            case 'basic': return { websites: 3, leads: 10000, apiCalls: 25000 }
            default: return { websites: 1, leads: 1000, apiCalls: 5000 }
        }
    }

    const limits = getPlanLimits(company?.plan_type)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                            <Building2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{company?.company_name}</h1>
                            <p className="text-sm text-gray-500">Company Settings & Configuration</p>
                        </div>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${company?.plan_type === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                            company?.plan_type === 'pro' ? 'bg-blue-100 text-blue-800' :
                                company?.plan_type === 'basic' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                        }`}>
                        {company?.plan_type?.toUpperCase()} Plan
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* Company Information */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            Company Information
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={settings.company_name}
                                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Domain
                                </label>
                                <input
                                    type="text"
                                    value={settings.domain}
                                    onChange={(e) => setSettings({ ...settings, domain: e.target.value })}
                                    placeholder="yourcompany.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Webhook URL (for real-time notifications)
                                </label>
                                <input
                                    type="url"
                                    value={settings.webhook_url}
                                    onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
                                    placeholder="https://yourserver.com/webhook"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </div>

                    {/* API Configuration */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Key className="h-5 w-5 text-blue-600" />
                            API Configuration
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tenant ID
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={company?.tenant_id || ''}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(company?.tenant_id)}
                                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    API Key
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            value={apiKey}
                                            readOnly
                                            className="w-full px-3 py-2 pr-10 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                                        />
                                        <button
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(apiKey)}
                                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    ⚠️ Keep this secret. Anyone with this key can access your company data.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Usage Stats */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                            Usage This Month
                        </h2>

                        {loadingUsage ? (
                            <div className="text-center py-4 text-gray-500">Loading...</div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm text-gray-700">Websites</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-gray-900">{usage?.websites || 0}</span>
                                        <span className="text-gray-500 text-sm"> / {limits.websites}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                            <circle cx="9" cy="7" r="4" />
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                        <span className="text-sm text-gray-700">Leads</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-gray-900">{usage?.leads || 0}</span>
                                        <span className="text-gray-500 text-sm"> / {limits.leads}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm text-gray-700">API Calls</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-gray-900">{usage?.usage?.api_calls || 0}</span>
                                        <span className="text-gray-500 text-sm"> / {limits.apiCalls}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs text-gray-500 text-center">
                                        Period: {usage?.usage?.period || 'Current Month'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Plan & Billing */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-blue-600" />
                            Plan & Billing
                        </h2>

                        <div className="space-y-4">
                            <div className={`p-4 rounded-lg border-2 ${company?.plan_type === 'enterprise' ? 'border-purple-200 bg-purple-50' :
                                    company?.plan_type === 'pro' ? 'border-blue-200 bg-blue-50' :
                                        'border-gray-200 bg-gray-50'
                                }`}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{company?.plan_type?.toUpperCase()} Plan</h3>
                                        <p className="text-sm text-gray-500">
                                            {company?.plan_type === 'enterprise' ? 'All features unlimited' :
                                                company?.plan_type === 'pro' ? 'Advanced features' :
                                                    'Basic features'}
                                        </p>
                                    </div>
                                    <Check className="h-5 w-5 text-green-500" />
                                </div>
                            </div>

                            {company?.plan_type !== 'enterprise' && (
                                <button className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all">
                                    Upgrade Plan
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Security */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Shield className="h-5 w-5 text-blue-600" />
                            Security
                        </h2>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <span className="text-sm text-gray-700">Row Level Security</span>
                                <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                                    <Check className="h-4 w-4" />
                                    Enabled
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <span className="text-sm text-gray-700">Data Encryption</span>
                                <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                                    <Check className="h-4 w-4" />
                                    AES-256
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <span className="text-sm text-gray-700">API Rate Limiting</span>
                                <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                                    <Check className="h-4 w-4" />
                                    Active
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Message Toast */}
            {message && (
                <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                    {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {message.text}
                </div>
            )}
        </div>
    )
}

export default CompanySettings
