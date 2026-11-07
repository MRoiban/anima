type Action = { vm: ViewModel?, action: Input<string> }
local function init(self: Action, context: Context): boolean
    self.vm = context:viewModel()
    return true
end
local function performAction(self: Action, event: ListenerContext)
    local vm = self.vm
    if vm == nil then return end
    local action = self.action
    if action == 'general' or action == 'sound' then
        local tab = vm:getString('selectedTab')
        if tab then tab.value = if action == 'general' then 'General' else 'Sound' end
    elseif action == 'increase' or action == 'decrease' then
        local volume = vm:getNumber('volume')
        if volume then volume.value = math.clamp(volume.value + (if action == 'increase' then 5 else -5), 0, 100) end
    elseif action == 'mute' then
        local muted = vm:getBoolean('muted')
        if muted then muted.value = not muted.value end
    elseif action == 'parent' then
        local email = vm:getBoolean('email')
        local push = vm:getBoolean('push')
        local sms = vm:getBoolean('sms')
        if email and push and sms then
            local nextValue = not (email.value and push.value and sms.value)
            email.value = nextValue
            push.value = nextValue
            sms.value = nextValue
        end
    else
        local child = vm:getBoolean(action)
        if child then child.value = not child.value end
    end
end
return function(): ListenerAction<Action>
    return { vm = nil, action = '', init = init, performAction = performAction }
end
