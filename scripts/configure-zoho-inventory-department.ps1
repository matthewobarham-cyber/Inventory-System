param(
  [string]$ProjectRef = 'lyhvjfqaulewxrxjodew'
)

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Zoho Inventory Requests department setup' -ForegroundColor Cyan
Write-Host 'Enter the numeric Zoho Desk department ID created for inventory loan requests.'
Write-Host 'This value is stored securely in Supabase and is not added to the application source.'
Write-Host ''

$departmentId = (Read-Host 'Inventory Requests department ID').Trim()
if ($departmentId -notmatch '^\d+$') {
  throw 'The Zoho department ID must contain numbers only.'
}

& npx supabase secrets set "ZOHO_INVENTORY_DEPARTMENT_ID=$departmentId" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw 'Supabase rejected the Zoho inventory department setting.' }

Write-Host ''
Write-Host 'Success: new inventory loan tickets will use the dedicated Zoho department.' -ForegroundColor Green
Write-Host 'In Zoho Desk, disable Contact Notifications > Receiving a new ticket for this department only.'
