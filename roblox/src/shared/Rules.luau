--!strict
-- All gameplay quantities are logical units; only rendering converts to studs.
return table.freeze({
 version = 1, protocol = 1, scale = 3, slots = 8, width = 30, depth = 19,
 step = 1/60, run = 6.2, acceleration = 42, friction = 16,
 holderMultiplier = 1.06, chargeMultiplier = 0.85,
 actorRadius = 0.45, ballRadius = 0.32, pickup = 0.75,
 passSpeed = 16, fullCharge = 0.55, chargeBoost = 1.6,
 apex = 0.9, gravity = 30, rebound = 0.62, looseFriction = 3.4,
 floorRebound = 0.42, floorThreshold = 2.5, firstLandingMultiplier = 0.8,
 catchHeight = 1.8, catchLock = 0.4, ownImmunity = 0.3, returnImmunity = 0.9,
 aimCone = math.rad(24), aimRange = 13, lead = 0.6,
 dashSpeed = 22, dashDuration = 0.14, dashCooldown = 1.6,
 windup = 0.09, strike = 0.05, follow = 0.14, recover = 0.12,
 countdown = 5, firstIntro = 1.6, intro = 1.1, round = 15,
 elimination = 1.6, intermission = 1.3, result = 5, inputTimeout = 0.25,
})
