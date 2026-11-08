-- Layout owns measurement; this controller preserves continuity on interruption.
type Motion = {
    measured: Property<number>?,
    output: Property<number>?,
    current: number,
    start: number,
    target: number,
    elapsed: number,
    ready: boolean,
}

local function init(self: Motion, context: Context): boolean
    local vm = context:viewModel()
    if vm then
        self.measured = vm:getNumber('buttonTextWidth')
        self.output = vm:getNumber('buttonWidth')
    end
    return true
end

local function advance(self: Motion, seconds: number): boolean
    local measured = self.measured
    local output = self.output
    if measured == nil or output == nil then
        return true
    end
    local target = measured.value + 24
    if not self.ready then
        if measured.value <= 0 then
            return true
        end
        self.current = target
        self.start = target
        self.target = target
        self.ready = true
    elseif math.abs(target - self.target) > 0.001 then
        self.start = self.current
        self.target = target
        self.elapsed = 0
    end
    self.elapsed = math.min(0.3, self.elapsed + seconds)
    self.current = self.start + (self.target - self.start) * self.elapsed / 0.3
    output.value = self.current
    return true
end

return function(): Node<Motion>
    return {
        measured = nil,
        output = nil,
        current = 0,
        start = 0,
        target = 0,
        elapsed = 0.3,
        ready = false,
        init = init,
        advance = advance,
    }
end
