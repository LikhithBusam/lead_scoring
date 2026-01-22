# Backend API Sanity Check Report
$api = "lsk_f4ba38b57529530bda94d71945a864cff89dee9d8b10a2cf826867ad9491af01"
$web = "b780c4ba-91aa-4a6e-82f8-dae91f3a6065"
$base = "http://localhost:3001"

$passed = 0
$failed = 0
$warnings = 0

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        BACKEND API SANITY CHECK REPORT                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Test 1: Health Endpoint
Write-Host "`n[TEST 1] Health Endpoint (GET /api/health)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $h = Invoke-RestMethod "$base/api/health" -Method GET
    Write-Host "  ✓ Status: $($h.status)" -ForegroundColor Green
    Write-Host "  ✓ Database: $($h.database)" -ForegroundColor Green
    Write-Host "  ✓ Cache: $($h.cache)" -ForegroundColor Green
    Write-Host "  ✓ Total Leads: $($h.totalLeads)" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 2: Multi-Tenant Leads API
Write-Host "`n[TEST 2] Get Leads - Multi-Tenant (GET /api/v1/leads)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $headers = @{ "X-API-Key" = $api }
    $leads = Invoke-RestMethod "$base/api/v1/leads" -Method GET -Headers $headers
    
    if ($leads.success) {
        Write-Host "  ✓ Success: $($leads.success)" -ForegroundColor Green
        Write-Host "  + Tenant: $($leads.tenant_name)" -ForegroundColor Green
        Write-Host "  ✓ Total Leads: $($leads.pagination.total)" -ForegroundColor Green
        
        if ($leads.leads.Count -gt 0) {
            $lead = $leads.leads[0]
            Write-Host "  ✓ Lead ID: $($lead.id)" -ForegroundColor Green
            Write-Host "  ✓ Score: $($lead.score)" -ForegroundColor Green
            Write-Host "  ✓ Classification: $($lead.classification)" -ForegroundColor Green
            
            # Check momentum data
            if ($lead.momentum) {
                Write-Host "  ✓ Momentum Score: $($lead.momentum.score)" -ForegroundColor Green
                Write-Host "  ✓ Momentum Level: $($lead.momentum.level)" -ForegroundColor Green
                Write-Host "  ✓ Actions 24h: $($lead.momentum.actionsLast24h)" -ForegroundColor Green
                Write-Host "  ✓ Classification Reason: $($lead.classificationReason)" -ForegroundColor Green
            } else {
                Write-Host "  ⚠ Momentum data missing" -ForegroundColor Yellow
                $warnings++
            }
        }
        $passed++
    } else {
        Write-Host "  ✗ Response not successful" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 3: Single Lead API
Write-Host "`n[TEST 3] Get Single Lead (GET /api/v1/leads/:id)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $headers = @{ "X-API-Key" = $api }
    $lead = Invoke-RestMethod "$base/api/v1/leads/7" -Method GET -Headers $headers
    
    Write-Host "  ✓ Lead ID: $($lead.lead.id)" -ForegroundColor Green
    Write-Host "  ✓ Email: $($lead.lead.email)" -ForegroundColor Green
    Write-Host "  ✓ Score: $($lead.lead.score)" -ForegroundColor Green
    Write-Host "  ✓ Activities: $($lead.activities.Count)" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 4: Tracking API
Write-Host "`n[TEST 4] Activity Tracking (POST /api/v1/track)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $headers = @{ 
        "Content-Type" = "application/json"
        "X-API-Key" = $api
        "X-Website-ID" = $web
    }
    $body = @{
        event_type = "page_view"
        visitor_id = "test-sanity-check"
        session_id = "test-session"
        email = "test@sanitycheck.com"
        page_url = "/test-page"
        page_title = "Test Page"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod "$base/api/v1/track" -Method POST -Headers $headers -Body $body
    
    Write-Host "  ✓ Success: $($result.success)" -ForegroundColor Green
    Write-Host "  ✓ Tracked: $($result.tracked)" -ForegroundColor Green
    Write-Host "  ✓ Event Type: $($result.event_type)" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 5: Auth - Missing Credentials
Write-Host "`n[TEST 5] Authentication - No API Key (Negative Test)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $result = Invoke-RestMethod "$base/api/v1/leads" -Method GET
    Write-Host "  ✗ Should have failed but succeeded" -ForegroundColor Red
    $failed++
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "  ✓ Correctly rejected (401 Unauthorized)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  ⚠ Unexpected error: $($_.Exception.Message)" -ForegroundColor Yellow
        $warnings++
    }
}

# Test 6: Rate Limiting Headers
Write-Host "`n[TEST 6] Security Headers Check" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $response = Invoke-WebRequest "$base/api/health" -Method GET
    
    $securityHeaders = @(
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection"
    )
    
    foreach ($header in $securityHeaders) {
        if ($response.Headers[$header]) {
            Write-Host "  ✓ $header: $($response.Headers[$header])" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ $header: Missing" -ForegroundColor Yellow
            $warnings++
        }
    }
    $passed++
} catch {
    Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 7: Scoring Rules API
Write-Host "`n[TEST 7] Scoring Rules Endpoint (GET /api/scoring-rules)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  ⚠ Requires JWT authentication (skipped for sanity check)" -ForegroundColor Yellow
$warnings++

# Test 8: Response Time Check
Write-Host "`n[TEST 8] API Response Time" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $headers = @{ "X-API-Key" = $api }
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $leads = Invoke-RestMethod "$base/api/v1/leads" -Method GET -Headers $headers
    $stopwatch.Stop()
    
    $responseTime = $stopwatch.ElapsedMilliseconds
    Write-Host "  ✓ Response Time: $responseTime ms" -ForegroundColor Green
    
    if ($responseTime -lt 500) {
        Write-Host "  ✓ Performance: Excellent (<500ms)" -ForegroundColor Green
    } elseif ($responseTime -lt 1000) {
        Write-Host "  ⚠ Performance: Acceptable (500-1000ms)" -ForegroundColor Yellow
        $warnings++
    } else {
        Write-Host "  ✗ Performance: Slow (>1000ms)" -ForegroundColor Red
        $failed++
    }
    $passed++
} catch {
    Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Summary Report
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                   SUMMARY REPORT                       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "  Tests Passed:   $passed" -ForegroundColor Green
Write-Host "  Tests Failed:   $failed" -ForegroundColor Red
Write-Host "  Warnings:       $warnings" -ForegroundColor Yellow
Write-Host ""

$total = $passed + $failed
$passRate = [math]::Round(($passed / $total) * 100, 2)

if ($failed -eq 0) {
    Write-Host "  ✓ All tests passed! ($passRate%)" -ForegroundColor Green
    Write-Host "  Status: PRODUCTION READY ✓" -ForegroundColor Green
} elseif ($passRate -ge 80) {
    Write-Host "  ⚠ Most tests passed ($passRate%)" -ForegroundColor Yellow
    Write-Host "  Status: NEEDS MINOR FIXES" -ForegroundColor Yellow
} else {
    Write-Host "  ✗ Multiple failures ($passRate%)" -ForegroundColor Red
    Write-Host "  Status: NEEDS ATTENTION" -ForegroundColor Red
}

Write-Host "`n════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
