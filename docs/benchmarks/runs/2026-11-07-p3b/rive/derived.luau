type Derived = { vm: ViewModel? }
local function init(self: Derived, context: Context): boolean
    self.vm = context:viewModel()
    return true
end
local function advance(self: Derived, seconds: number): boolean
    local vm = self.vm
    if vm == nil then return true end
    local volume = vm:getNumber('volume')
    local spoken = vm:getString('volumeSpoken')
    local title = vm:getString('volumeTitle')
    if volume and spoken and title then
        volume.value = math.clamp(volume.value, 0, 100)
        spoken.value = title.value .. ' ' .. tostring(volume.value) .. ' %'
    end
    local selected = vm:getString('selectedTab')
    local general = vm:getBoolean('generalSelected')
    local sound = vm:getBoolean('soundSelected')
    if selected and general and sound then
        general.value = selected.value == 'General'
        sound.value = selected.value == 'Sound'
        local go = vm:getNumber('generalOpacity')
        local so = vm:getNumber('soundOpacity')
        if go and so then
            go.value = if general.value then 1 else 0
            so.value = if sound.value then 1 else 0
        end
    end
    local count = 0
    for _, name in {'email', 'push', 'sms'} do
        local checked = vm:getBoolean(name)
        local state = vm:getNumber(name .. 'State')
        if checked and state then
            state.value = if checked.value then 1 else 0
            if checked.value then count += 1 end
        end
    end
    local state = vm:getNumber('parentState')
    local full = vm:getNumber('parentFull')
    local mixed = vm:getNumber('parentMixed')
    if state and full and mixed then
        state.value = if count == 3 then 1 elseif count == 0 then 0 else 2
        full.value = if count == 3 then 1 else 0
        mixed.value = if count > 0 and count < 3 then 1 else 0
    end
    local muted = vm:getBoolean('muted')
    local knob = vm:getNumber('knobX')
    if muted and knob then knob.value = if muted.value then 54 else 18 end
    return true
end
return function(): Node<Derived>
    return { vm = nil, init = init, advance = advance }
end
