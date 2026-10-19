--!strict
-- Included only by test.project.json. No test remote exists in either place.
if not game:GetService('RunService'):IsStudio() then return end
local shared=game:GetService('ReplicatedStorage'):WaitForChild('GhostBall'):WaitForChild('Shared')
local R=require(shared.Rules); local M=require(shared.Math)
local move=require(shared.Movement)(R,M)
local server=game:GetService('ServerScriptService'):WaitForChild('GhostBall')
local suite=require(game:GetService('ServerStorage'):WaitForChild('GhostBallTests'):WaitForChild('Suite'))
suite(R,M,move,require(shared.Sim)(R,M,move),require(shared.Protocol)(M),require(server.InputGateway),require(shared.Bots)(R,M))
local tests=game:GetService('ServerStorage'):WaitForChild('GhostBallTests')
require(tests.Regressions)(R,M,move,require(shared.Sim)(R,M,move),require(shared.Protocol)(M),require(server.InputGateway),require(shared.Clock),require(tests.Prediction),require(shared.CameraFit))
require(tests.InputHandlers)(require(tests.InputController))
require(tests.CameraAdapter)(require(tests.CameraController),require(shared.CameraFit),R)
require(tests.HUDLayout)(require(tests.HUD),require(shared.CameraFit))
print('GhostBall pure suite finished inside Studio; client/device tests still required')
