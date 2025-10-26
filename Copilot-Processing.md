# Copilot Processing - Issue: selecteren van baan of starter

## Issue Summary
Create a new page that lists all WebSocket connections and allows management of device properties.

## Requirements
1. Create a new page displaying all WebSocket connections
2. Not all connections are devices and don't need to send device information
3. WebSocket connections can be start/clock devices (swimwatch-hardware)
4. When a device registers, it sends:
   - IP address
   - MAC address
   - Role (starter, lane)
   - Lane number
5. From this page, it should be possible to send WebSocket messages to devices to:
   - Change the role
   - Change the lane number

## Status
- Phase: Initialization
- Current Step: Repository exploration

## Notes
- Fresh clone of repository
- Need to understand existing WebSocket implementation
- Need to understand device registration protocol
- Need to create new management page
