--!strict
-- Syntax-checked entry; engine-facing source lacks CLI engine type definitions.
require('./InputHandlers')(require('../src/client/InputController'))
require('./CameraAdapter')(require('../src/client/CameraController'),require('../src/shared/CameraFit'),require('../src/shared/Rules'))
require('./HUDLayout')(require('../src/client/HUD'),require('../src/shared/CameraFit'))
