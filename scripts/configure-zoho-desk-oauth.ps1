param(
  [string]$ProjectRef = 'lyhvjfqaulewxrxjodew',
  [string]$AccountsUrl = 'https://accounts.zoho.com'
)

$ErrorActionPreference = 'Stop'

function Read-SecretText([string]$Prompt) {
  $secureValue = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

Write-Host ''
Write-Host 'Zoho Desk OAuth setup for PDF attachments and requester email' -ForegroundColor Cyan
Write-Host 'Generate a fresh Self Client code with both scopes:' -ForegroundColor Yellow
Write-Host 'Desk.tickets.ALL,Desk.basic.CREATE' -ForegroundColor Yellow
Write-Host 'The values entered below are not printed or saved to PowerShell history.'
Write-Host ''

$zohoClientId = Read-Host 'Zoho Client ID'
$zohoClientSecret = Read-SecretText 'Zoho Client Secret'
$zohoGrantCode = Read-SecretText 'Fresh Self Client grant code'

try {
  $tokenResponse = Invoke-RestMethod -Method Post -Uri "$($AccountsUrl.TrimEnd('/'))/oauth/v2/token" -ContentType 'application/x-www-form-urlencoded' -Body @{
    grant_type    = 'authorization_code'
    client_id     = $zohoClientId
    client_secret = $zohoClientSecret
    code          = $zohoGrantCode
  }

  if (-not $tokenResponse.refresh_token) {
    $tokenError = if ($tokenResponse.error) { $tokenResponse.error } else { 'Zoho did not return a refresh token.' }
    throw "OAuth exchange failed: $tokenError"
  }

  & npx supabase secrets set "ZOHO_REFRESH_TOKEN=$($tokenResponse.refresh_token)" --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw 'Supabase rejected the updated refresh token.' }

  Write-Host ''
  Write-Host 'Success: the new Zoho refresh token is stored in Supabase.' -ForegroundColor Green
  Write-Host 'Return to Admin > Requests and retry the request whose PDF email failed.'
}
finally {
  $zohoClientSecret = $null
  $zohoGrantCode = $null
  $tokenResponse = $null
}
