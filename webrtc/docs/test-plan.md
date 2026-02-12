# Test Plan

## Milestone 1 implemented tests
- Room domain behavior
  - join/participant list
  - max rooms per connection
  - max participants per room
- Protocol schema validation

## Milestone 2 validation approach
- Manual browser validation:
  1. Open two tabs
  2. Join same room with unique users
  3. Verify participant list updates
  4. Verify offer/answer/ICE exchange and two-way audio
  5. Toggle mute and verify state updates
  6. Stop signaling server briefly to verify reconnect + rejoin
- TURN relay validation:
  - configure turn credentials to match coturn
  - force relay candidate policy during test
