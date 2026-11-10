local SCALE = 12
local UPPER = 9 * SCALE
local FORE = 8 * SCALE
local MAX_REACH = UPPER + FORE
local MIN_REACH = UPPER - FORE
local HALF_SLEEVE = SCALE
local RELEASE_SECONDS = 0.4
local SHOULDER = Vector.xy(8 * SCALE, 20 * SCALE)
local REST_HAND = Vector.xy(25 * SCALE, 20 * SCALE)
local EYE = Vector.xy(32 * SCALE, 6 * SCALE)

type ArmScene = {
    size: Vector,
    hand: Vector,
    elbow: Vector,
    pupil: Vector,
    pointer: Vector,
    active: boolean,
    releasing: boolean,
    releaseTime: number,
    releaseHand: Vector,
    releasePupil: Vector,
    ink: Paint,
    accent: Paint,
    panel: Paint,
}

local function vec(x: number, y: number): Vector
    return Vector.xy(x, y)
end

local function add(a: Vector, b: Vector): Vector
    return vec(a.x + b.x, a.y + b.y)
end

local function sub(a: Vector, b: Vector): Vector
    return vec(a.x - b.x, a.y - b.y)
end

local function mul(a: Vector, k: number): Vector
    return vec(a.x * k, a.y * k)
end

local function length(a: Vector): number
    return math.sqrt(a.x * a.x + a.y * a.y)
end

local function unit(a: Vector): Vector
    local d = length(a)
    if d < 0.000001 then
        return vec(1, 0)
    end
    return mul(a, 1 / d)
end

local function clamp(x: number, lo: number, hi: number): number
    return math.max(lo, math.min(hi, x))
end

local function lerp(a: Vector, b: Vector, t: number): Vector
    return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
end

local function solveHand(target: Vector): (Vector, Vector)
    local delta = sub(target, SHOULDER)
    local d = length(delta)
    local direction = unit(delta)
    if d >= MAX_REACH then
        local hand = add(SHOULDER, mul(direction, MAX_REACH))
        return add(SHOULDER, mul(direction, UPPER)), hand
    end

    -- A 9/8 two-link chain has an unavoidable 1-unit inner dead zone.
    local solvedDistance = math.max(d, MIN_REACH)
    local hand = if d < MIN_REACH then add(SHOULDER, mul(direction, MIN_REACH)) else target
    local base = math.atan2(direction.y, direction.x)
    local cosAlpha = clamp(
        (UPPER * UPPER + solvedDistance * solvedDistance - FORE * FORE)
            / (2 * UPPER * solvedDistance),
        -1,
        1
    )
    local alpha = math.acos(cosAlpha)
    -- In screen coordinates (+y down), +alpha puts the elbow on the right side
    -- of the shoulder->hand direction, so a rightward reach hangs downward.
    local elbow = vec(
        SHOULDER.x + UPPER * math.cos(base + alpha),
        SHOULDER.y + UPPER * math.sin(base + alpha)
    )
    return elbow, hand
end

local function solvePupil(pointer: Vector): Vector
    local delta = sub(pointer, EYE)
    local d = length(delta)
    if d < 0.000001 then
        return EYE
    end
    return add(EYE, mul(delta, math.min(SCALE, d) / d))
end

local function sleevePoints(elbow: Vector, hand: Vector): (Vector, Vector, Vector, Vector, Vector, Vector)
    local u1 = unit(sub(elbow, SHOULDER))
    local u2 = unit(sub(hand, elbow))
    local n1 = vec(-u1.y, u1.x)
    local n2 = vec(-u2.y, u2.x)
    local sum = add(n1, n2)
    local m = unit(sum)
    local denom = m.x * n1.x + m.y * n1.y
    local miter = HALF_SLEEVE
    if math.abs(denom) > 0.001 then
        miter = clamp(HALF_SLEEVE / denom, -3 * HALF_SLEEVE, 3 * HALF_SLEEVE)
    end
    local plus1 = add(elbow, mul(n1, HALF_SLEEVE))
    local plus2 = add(elbow, mul(n2, HALF_SLEEVE))
    local plusControl = add(elbow, mul(m, miter))
    local minus2 = add(elbow, mul(n2, -HALF_SLEEVE))
    local minus1 = add(elbow, mul(n1, -HALF_SLEEVE))
    local minusControl = add(elbow, mul(m, -miter))
    return plus1, plusControl, plus2, minus2, minusControl, minus1
end

local function logState(self: ArmScene, label: string): ()
    local a, b, c, d, e, f = sleevePoints(self.elbow, self.hand)
    print(string.format(
        "PROOF %s hand=(%.4f,%.4f) elbow=(%.4f,%.4f) pupil=(%.4f,%.4f) sleeve=(%.4f,%.4f)|(%.4f,%.4f)|(%.4f,%.4f)|(%.4f,%.4f)|(%.4f,%.4f)|(%.4f,%.4f)",
        label,
        self.hand.x / SCALE, self.hand.y / SCALE,
        self.elbow.x / SCALE, self.elbow.y / SCALE,
        self.pupil.x / SCALE, self.pupil.y / SCALE,
        a.x / SCALE, a.y / SCALE,
        b.x / SCALE, b.y / SCALE,
        c.x / SCALE, c.y / SCALE,
        d.x / SCALE, d.y / SCALE,
        e.x / SCALE, e.y / SCALE,
        f.x / SCALE, f.y / SCALE
    ))
end

local function circle(path: Path, center: Vector, radius: number): ()
    local k = 0.5522847498307936 * radius
    path:moveTo(vec(center.x + radius, center.y))
    path:cubicTo(vec(center.x + radius, center.y + k), vec(center.x + k, center.y + radius), vec(center.x, center.y + radius))
    path:cubicTo(vec(center.x - k, center.y + radius), vec(center.x - radius, center.y + k), vec(center.x - radius, center.y))
    path:cubicTo(vec(center.x - radius, center.y - k), vec(center.x - k, center.y - radius), vec(center.x, center.y - radius))
    path:cubicTo(vec(center.x + k, center.y - radius), vec(center.x + radius, center.y - k), vec(center.x + radius, center.y))
    path:close()
end

local function updateFromPointer(self: ArmScene, pointer: Vector): ()
    self.pointer = pointer
    self.elbow, self.hand = solveHand(pointer)
    self.pupil = solvePupil(pointer)
    self.active = true
    self.releasing = false
    self.releaseTime = 0
end

local function init(self: ArmScene, _context: Context): boolean
    self.elbow, self.hand = solveHand(REST_HAND)
    self.pupil = EYE
    logState(self, "rest")
    return true
end

local function resize(self: ArmScene, size: Vector, _scale: number): ()
    self.size = size
end

local function advance(self: ArmScene, seconds: number): boolean
    if not self.releasing then
        return false
    end
    self.releaseTime = math.min(RELEASE_SECONDS, self.releaseTime + seconds)
    local t = self.releaseTime / RELEASE_SECONDS
    local desired = lerp(self.releaseHand, REST_HAND, t)
    self.elbow, self.hand = solveHand(desired)
    self.pupil = lerp(self.releasePupil, EYE, t)
    logState(self, string.format("leave@%.4f", self.releaseTime))
    if t >= 1 then
        self.releasing = false
        self.active = false
    end
    return true
end

local function beginRelease(self: ArmScene): ()
    if self.releasing then
        return
    end
    self.releaseHand = self.hand
    self.releasePupil = self.pupil
    self.releaseTime = 0
    self.releasing = true
    self.active = false
    logState(self, "leave@0.0000")
end

local function pointerMove(self: ArmScene, event: PointerEvent): ()
    if event.type == 'pointerExit' then
        beginRelease(self)
        event:hit()
        return
    end
    updateFromPointer(self, event.position)
    logState(self, string.format("pointer(%.4f,%.4f)", event.position.x / SCALE, event.position.y / SCALE))
    event:hit()
end

local function pointerDown(self: ArmScene, event: PointerEvent): ()
    updateFromPointer(self, event.position)
    logState(self, string.format("pointer(%.4f,%.4f)", event.position.x / SCALE, event.position.y / SCALE))
    event:hit()
end

local function pointerUp(self: ArmScene, event: PointerEvent): ()
    updateFromPointer(self, event.position)
    logState(self, string.format("pointer(%.4f,%.4f)", event.position.x / SCALE, event.position.y / SCALE))
    event:hit()
end

local function pointerExit(self: ArmScene, event: PointerEvent): ()
    beginRelease(self)
    event:hit()
end

local function draw(self: ArmScene, renderer: Renderer): ()
    local bg = Path.new()
    bg:moveTo(vec(0, 0))
    bg:lineTo(vec(self.size.x, 0))
    bg:lineTo(vec(self.size.x, self.size.y))
    bg:lineTo(vec(0, self.size.y))
    bg:close()
    renderer:drawPath(bg, self.panel)

    local p1, pc1, p2, m2, mc, m1 = sleevePoints(self.elbow, self.hand)
    local u1 = unit(sub(self.elbow, SHOULDER))
    local u2 = unit(sub(self.hand, self.elbow))
    local n1 = vec(-u1.y, u1.x)
    local n2 = vec(-u2.y, u2.x)
    local sleeve = Path.new()
    sleeve:moveTo(add(SHOULDER, mul(n1, -HALF_SLEEVE)))
    sleeve:lineTo(m1)
    sleeve:quadTo(mc, m2)
    sleeve:lineTo(add(self.hand, mul(n2, -HALF_SLEEVE)))
    sleeve:lineTo(add(self.hand, mul(n2, HALF_SLEEVE)))
    sleeve:lineTo(p2)
    sleeve:quadTo(pc1, p1)
    sleeve:lineTo(add(SHOULDER, mul(n1, HALF_SLEEVE)))
    sleeve:close()
    renderer:drawPath(sleeve, self.accent)

    local handPath = Path.new()
    circle(handPath, self.hand, 1.2 * SCALE)
    renderer:drawPath(handPath, self.ink)

    local eyeOuter = Path.new()
    circle(eyeOuter, EYE, 2 * SCALE)
    renderer:drawPath(eyeOuter, self.ink)
    local eyeInner = Path.new()
    circle(eyeInner, EYE, (2 - 0.3) * SCALE)
    renderer:drawPath(eyeInner, self.panel)
    local pupilPath = Path.new()
    circle(pupilPath, self.pupil, 0.6 * SCALE)
    renderer:drawPath(pupilPath, self.ink)
end

return function(_context: Context): Layout<ArmScene>
    return {
        size = vec(480, 360),
        hand = REST_HAND,
        elbow = vec(17 * SCALE, 20 * SCALE),
        pupil = EYE,
        pointer = REST_HAND,
        active = false,
        releasing = false,
        releaseTime = 0,
        releaseHand = REST_HAND,
        releasePupil = EYE,
        ink = Paint.with({ color = Color.rgb(20, 20, 19), style = 'fill' }),
        accent = Paint.with({ color = Color.rgb(217, 119, 87), style = 'fill' }),
        panel = Paint.with({ color = Color.rgb(240, 238, 230), style = 'fill' }),
        init = init,
        resize = resize,
        advance = advance,
        draw = draw,
        pointerMove = pointerMove,
        pointerDown = pointerDown,
        pointerUp = pointerUp,
        pointerExit = pointerExit,
    }
end
