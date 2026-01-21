import { useState, useEffect } from 'react'
import {
    Building2, Plus, ChevronRight, Globe, Users,
    BarChart3, Key, Loader2, Check, Sparkles
} from 'lucide-react'

const CompanySelector = ({ onSelectCompany, currentCompany }) => {
    const [companies, setCompanies] = useState([])
    const [loading, setLoading] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [apiKeyInput, setApiKeyInput] = useState('')
    const [verifyingKey, setVerifyingKey] = useState(false)
    const [error, setError] = useState('')

    // Create company form state
    const [newCompany, setNewCompany] = useState({
        company_name: '',
        domain: '',
        plan_type: 'free',
        template: 'saas'
    })
    const [creating, setCreating] = useState(false)

    // Load saved companies from localStorage
    useEffect(() => {
        const savedCompanies = JSON.parse(localStorage.getItem('savedCompanies') || '[]')
        setCompanies(savedCompanies)
    }, [])

    // Save companies to localStorage
    const saveCompanyToList = (company) => {
        const savedCompanies = JSON.parse(localStorage.getItem('savedCompanies') || '[]')
        // Check if already exists
        const exists = savedCompanies.find(c => c.tenant_id === company.tenant_id)
        if (!exists) {
            savedCompanies.push({
                tenant_id: company.tenant_id,
                company_name: company.company_name,
                plan_type: company.plan_type,
                api_key: company.api_key
            })
            localStorage.setItem('savedCompanies', JSON.stringify(savedCompanies))
            setCompanies(savedCompanies)
        }
    }

    // Quick connect with demo API key
    const handleQuickConnect = async (apiKey) => {
        setVerifyingKey(true)
        setError('')

        try {
            const response = await fetch('/api/v1/tenants/me', {
                headers: { 'X-API-Key': apiKey }
            })
            const data = await response.json()

            if (data.success) {
                const company = { ...data.tenant, api_key: apiKey }
                saveCompanyToList(company)
                onSelectCompany(company)
            } else {
                setError('Failed to connect to demo account')
            }
        } catch (err) {
            setError('Failed to connect. Is the server running?')
        } finally {
            setVerifyingKey(false)
        }
    }

    // Verify API key and load company
    const handleVerifyApiKey = async () => {
        if (!apiKeyInput.trim()) {
            setError('Please enter an API key')
            return
        }

        setVerifyingKey(true)
        setError('')

        try {
            const response = await fetch('/api/v1/tenants/me', {
                headers: { 'X-API-Key': apiKeyInput.trim() }
            })
            const data = await response.json()

            if (data.success) {
                const company = { ...data.tenant, api_key: apiKeyInput.trim() }
                saveCompanyToList(company)
                onSelectCompany(company)
            } else {
                setError('Invalid API key or company not found')
            }
        } catch (err) {
            setError('Failed to verify API key. Check your connection.')
        } finally {
            setVerifyingKey(false)
        }
    }

    // Create new company
    const handleCreateCompany = async () => {
        if (!newCompany.company_name.trim()) {
            setError('Company name is required')
            return
        }

        setCreating(true)
        setError('')

        try {
            const response = await fetch('/api/v1/tenants/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_name: newCompany.company_name,
                    domain: newCompany.domain || undefined,
                    plan_type: newCompany.plan_type
                })
            })
            const data = await response.json()

            if (data.success) {
                const company = {
                    tenant_id: data.tenant.tenant_id,
                    company_name: data.tenant.company_name,
                    plan_type: data.tenant.plan_type,
                    api_key: data.tenant.api_key
                }
                saveCompanyToList(company)

                // Show success with API key
                alert(`🎉 Company Created!\n\nCompany: ${company.company_name}\nAPI Key: ${company.api_key}\n\n⚠️ Save this API key! You'll need it to access this company.`)

                onSelectCompany(company)
            } else {
                setError(data.error || 'Failed to create company')
            }
        } catch (err) {
            setError('Failed to create company. Check your connection.')
        } finally {
            setCreating(false)
        }
    }

    // Select existing company
    const handleSelectExisting = (company) => {
        onSelectCompany(company)
    }

    // Remove company from list
    const handleRemoveCompany = (e, tenantId) => {
        e.stopPropagation()
        const savedCompanies = JSON.parse(localStorage.getItem('savedCompanies') || '[]')
        const filtered = savedCompanies.filter(c => c.tenant_id !== tenantId)
        localStorage.setItem('savedCompanies', JSON.stringify(filtered))
        setCompanies(filtered)
    }

    const getPlanColor = (plan) => {
        switch (plan) {
            case 'enterprise': return 'bg-purple-100 text-purple-800'
            case 'pro': return 'bg-blue-100 text-blue-800'
            case 'basic': return 'bg-green-100 text-green-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                            <BarChart3 className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Lead Scoring CRM</h1>
                    <p className="text-slate-400">Select a company or create a new one to get started</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Left Panel - Existing Companies */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-blue-400" />
                            Your Companies
                        </h2>

                        {companies.length > 0 ? (
                            <div className="space-y-3 mb-6">
                                {companies.map(company => (
                                    <div
                                        key={company.tenant_id}
                                        onClick={() => handleSelectExisting(company)}
                                        className="bg-white/10 hover:bg-white/20 rounded-xl p-4 cursor-pointer transition-all group border border-transparent hover:border-blue-400"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-white">{company.company_name}</p>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPlanColor(company.plan_type)}`}>
                                                        {company.plan_type}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    ID: {company.tenant_id?.substring(0, 8)}...
                                                </p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                        <button
                                            onClick={(e) => handleRemoveCompany(e, company.tenant_id)}
                                            className="text-xs text-red-400 hover:text-red-300 mt-2"
                                        >
                                            Remove from list
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p className="text-sm">No companies saved yet</p>
                                <p className="text-xs mt-1">Create a new company or enter an API key</p>
                            </div>
                        )}

                        {/* Enter API Key */}
                        <div className="border-t border-white/10 pt-4">
                            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                Have an API Key?
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder="lsk_xxxxxxxx..."
                                    className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    onClick={handleVerifyApiKey}
                                    disabled={verifyingKey}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {verifyingKey ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Create New Company */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-green-400" />
                            Create New Company
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Company Name *
                                </label>
                                <input
                                    type="text"
                                    value={newCompany.company_name}
                                    onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                                    placeholder="Acme Corporation"
                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Domain (optional)
                                </label>
                                <input
                                    type="text"
                                    value={newCompany.domain}
                                    onChange={(e) => setNewCompany({ ...newCompany, domain: e.target.value })}
                                    placeholder="acme.com"
                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Plan Type
                                </label>
                                <select
                                    value={newCompany.plan_type}
                                    onChange={(e) => setNewCompany({ ...newCompany, plan_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="free" className="bg-slate-800">Free</option>
                                    <option value="basic" className="bg-slate-800">Basic</option>
                                    <option value="pro" className="bg-slate-800">Pro</option>
                                    <option value="enterprise" className="bg-slate-800">Enterprise</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Scoring Template
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['saas', 'b2b', 'ecommerce'].map(template => (
                                        <button
                                            key={template}
                                            onClick={() => setNewCompany({ ...newCompany, template })}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${newCompany.template === template
                                                    ? 'bg-blue-600 text-white border-2 border-blue-400'
                                                    : 'bg-white/10 text-slate-300 border-2 border-transparent hover:border-white/30'
                                                }`}
                                        >
                                            {template.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    Template applies default page scoring rules for your business type
                                </p>
                            </div>

                            <button
                                onClick={handleCreateCompany}
                                disabled={creating}
                                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5" />
                                        Create Company
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-center">
                        {error}
                    </div>
                )}

                {/* Demo Accounts Quick Access */}
                <div className="mt-6 bg-yellow-500/10 backdrop-blur-lg rounded-2xl p-6 border border-yellow-500/30">
                    <h3 className="text-lg font-semibold text-yellow-300 mb-3">🚀 Quick Demo Access</h3>
                    <p className="text-sm text-slate-300 mb-4">
                        Use these test accounts to see leads from the demo websites:
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="font-medium text-white mb-1">☁️ CloudFlow (vinaykumar)</p>
                            <p className="text-xs text-slate-400 mb-2">SaaS demo site leads</p>
                            <button
                                onClick={() => handleQuickConnect('lsk_5d9ff8f05646dcd6800d0e61d38846f77c374a4a201654cfefc44e65bdbb7db7')}
                                disabled={verifyingKey}
                                className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {verifyingKey ? 'Connecting...' : 'Connect CloudFlow'}
                            </button>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4">
                            <p className="font-medium text-white mb-1">⚡ TechGear (TechCorp)</p>
                            <p className="text-xs text-slate-400 mb-2">E-commerce demo site leads</p>
                            <button
                                onClick={() => handleQuickConnect('lsk_7912d8b2be8246cca164d342dc2b2fa1d30b2b58f1cb75aeddb2d914433cec43')}
                                disabled={verifyingKey}
                                className="w-full py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                {verifyingKey ? 'Connecting...' : 'Connect TechGear'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8 text-slate-500 text-sm">
                    <p>Lead Scoring CRM v1.0 • Multi-Tenant SaaS</p>
                </div>
            </div>
        </div>
    )
}

export default CompanySelector
