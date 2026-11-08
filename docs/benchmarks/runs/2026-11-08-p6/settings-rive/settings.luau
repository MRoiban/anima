type Settings = { vm: ViewModel?, knob: number }

function init(self: Settings, context: Context): boolean
    self.vm = context:viewModel()
    return true
end

function advance(self: Settings, seconds: number): boolean
    local vm = self.vm
    if vm == nil then return false end
    local action = assert(vm:getString('action'))
    local tab = assert(vm:getString('selectedTab'))
    local volume = assert(vm:getNumber('volume'))
    local muted = assert(vm:getBoolean('muted'))
    local email = assert(vm:getBoolean('email'))
    local push = assert(vm:getBoolean('push'))
    local sms = assert(vm:getBoolean('sms'))
    if action.value == 'general' then tab.value = 'General' end
    if action.value == 'sound' then tab.value = 'Sound' end
    if action.value == 'increase' then volume.value = math.min(100, volume.value + 5) end
    if action.value == 'decrease' then volume.value = math.max(0, volume.value - 5) end
    if action.value == 'mute' then muted.value = not muted.value end
    if action.value == 'email' then email.value = not email.value end
    if action.value == 'push' then push.value = not push.value end
    if action.value == 'sms' then sms.value = not sms.value end
    if action.value == 'parent' then
        local checked = not (email.value and push.value and sms.value)
        email.value = checked
        push.value = checked
        sms.value = checked
    end
    action.value = ''
    volume.value = math.clamp(volume.value, 0, 100)
    local general = tab.value ~= 'Sound'
    assert(vm:getBoolean('generalSelected')).value = general
    assert(vm:getBoolean('soundSelected')).value = not general
    assert(vm:getBoolean('generalHidden')).value = not general
    assert(vm:getBoolean('soundHidden')).value = general
    assert(vm:getNumber('generalOpacity')).value = if general then 1 else 0
    assert(vm:getNumber('soundOpacity')).value = if general then 0 else 1
    assert(vm:getNumber('generalFill')).value = if general then 1 else 0
    assert(vm:getNumber('soundFill')).value = if general then 0 else 1
    local count = (if email.value then 1 else 0) + (if push.value then 1 else 0) + (if sms.value then 1 else 0)
    assert(vm:getNumber('parentState')).value = if count == 3 then 1 elseif count == 0 then 0 else 2
    assert(vm:getNumber('parentFill')).value = if count == 3 then 1 else 0
    assert(vm:getNumber('parentBar')).value = if count > 0 and count < 3 then 1 else 0
    assert(vm:getNumber('emailState')).value = if email.value then 1 else 0
    assert(vm:getNumber('pushState')).value = if push.value then 1 else 0
    assert(vm:getNumber('smsState')).value = if sms.value then 1 else 0
    assert(vm:getNumber('emailFill')).value = if email.value then 1 else 0
    assert(vm:getNumber('pushFill')).value = if push.value then 1 else 0
    assert(vm:getNumber('smsFill')).value = if sms.value then 1 else 0
    assert(vm:getNumber('volumeWidth')).value = volume.value * 3.6
    assert(vm:getString('volumeSpoken')).value = assert(vm:getString('volumeLabel')).value .. ' ' .. tostring(volume.value) .. ' %'
    local target = if muted.value then 39.6 else 3.6
    self.knob += (target - self.knob) * math.min(1, seconds * 18)
    assert(vm:getNumber('knobX')).value = self.knob
    return true
end

return function(context: Context): Layout<Settings>
    return { vm = nil, knob = 3.6, init = init, advance = advance }
end
