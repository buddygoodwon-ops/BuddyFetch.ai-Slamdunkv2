# SLAMDUNK v2 - Buddy SlamDunk VAPI x LiveKit bridge
# A COPY of how Ginger / Kate's rooms are run (run-ilendgirlv3.ps1 pattern). It does not touch them.
# Each avatar = one bridge process with its own room + LemonSlice avatar + VAPI assistant + port.
#
#   Room:       slamdunk-demo          (new - the Live Chat page asks for this room)
#   Avatar:     LemonSlice "Buddy SlamDunk Technologies"  agent_70dc8e96528c845e
#   VAPI:       "SlamDunk Technologies Chat Agent"         74e74f38-c879-43dd-8f8c-4e0466fd2317
#   Port:       8774                   (pick any port no other bridge is using)
#
# Put this file in the SAME folder as the bridge .py that Ginger's room runs from
# (the folder with .env.local - LiveKit + VAPI + LemonSlice keys are read from there).
# Start:  powershell -ExecutionPolicy Bypass -File run-slamdunk-bridge.ps1
# Check:  http://127.0.0.1:8774/health   ->  "bridge_connected": true

$env:PYTHONUNBUFFERED = '1'
$env:LEMONSLICE_AGENT_ID = 'agent_70dc8e96528c845e'   # Buddy SlamDunk Technologies (only this process)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# Same Python + same bridge file Ginger uses. If Ginger's room runs a different bridge file
# than vapi_livekit_bridge_v11_library.py, put THAT file name here instead.
& 'C:\Users\Kyle\.openclaw\workspace\buddy\talking-dog-app\livekit-lemonslice-agent\.venv\Scripts\python.exe' `
  "$here\vapi_livekit_bridge_v11_library.py" `
  --room slamdunk-demo `
  --assistant 74e74f38-c879-43dd-8f8c-4e0466fd2317 `
  --port 8774 2>&1 | Tee-Object -FilePath "$here\bridge-slamdunk.log"
