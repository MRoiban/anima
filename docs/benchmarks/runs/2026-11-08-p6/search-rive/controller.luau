-- The script owns computation and text events; markup owns every visible element.
type Search = { vm: ViewModel? }

function init(self: Search, context: Context): boolean
    self.vm = context:viewModel()
    return true
end

function advance(self: Search, seconds: number): boolean
    local vm = self.vm
    if vm == nil then return false end
    local query = vm:getString('query')
    if query == nil then return false end
    local needle = string.lower(query.value)
    local count = 0
    for i = 1, 5 do
        local label = vm:getString('label' .. tostring(i))
        local opacity = vm:getNumber('opacity' .. tostring(i))
        local hidden = vm:getBoolean('hidden' .. tostring(i))
        if label ~= nil and opacity ~= nil and hidden ~= nil then
            local shown = needle == '' or string.find(string.lower(label.value), needle, 1, true) ~= nil
            opacity.value = if shown then 1 else 0
            hidden.value = not shown
            if shown then count += 1 end
        end
    end
    local shownCount = vm:getNumber('count')
    local countText = vm:getString('countText')
    local fieldText = vm:getString('fieldText')
    local fieldColor = vm:getColor('fieldColor')
    if shownCount ~= nil then shownCount.value = count end
    if countText ~= nil then countText.value = tostring(count) .. ' results' end
    if fieldText ~= nil then fieldText.value = if query.value == '' then 'Search' else query.value end
    if fieldColor ~= nil then
        fieldColor.value = if query.value == '' then Color.rgb(120, 120, 115) else Color.rgb(20, 20, 19)
    end
    return true
end

function textEvent(self: Search, event: TextInput)
    local vm = self.vm
    if vm == nil then return end
    local query = vm:getString('query')
    if query ~= nil then query.value ..= event.text end
end

function keyboardEvent(self: Search, event: KeyboardEvent)
    if event.phase == 'up' then return end
    local vm = self.vm
    if vm == nil then return end
    local query = vm:getString('query')
    if query == nil then return end
    if event.key == 259 then
        local last = utf8.offset(query.value, -1)
        if last ~= nil then query.value = string.sub(query.value, 1, last - 1) end
    elseif event.key == 256 then
        query.value = ''
    elseif event.key >= 65 and event.key <= 90 and not event.control and not event.meta then
        local letter = string.char(event.key)
        query.value ..= if event.shift then letter else string.lower(letter)
    elseif event.key >= 32 and event.key <= 64 and not event.control and not event.meta then
        query.value ..= string.char(event.key)
    end
end

function resize(self: Search, size: Vector, scale: number) end
function draw(self: Search, renderer: Renderer) end

return function(context: Context): Layout<Search>
    return {
        vm = nil,
        init = init,
        advance = advance,
        resize = resize,
        draw = draw,
        textEvent = textEvent,
        keyboardEvent = keyboardEvent,
    }
end
