--!strict
local R=require('../src/shared/Rules')
local M=require('../src/shared/Math')
local move=require('../src/shared/Movement')(R,M)
local Sim=require('../src/shared/Sim')(R,M,move)
local P=require('../src/shared/Protocol')(M)
local Gateway=require('../src/server/InputGateway')
local bots=require('../src/shared/Bots')(R,M)
require('./Suite')(R,M,move,Sim,P,Gateway,bots)

require('./Regressions')(R,M,move,Sim,P,Gateway,require('../src/shared/Clock'),require('../src/client/Prediction'),require('../src/shared/CameraFit'))
