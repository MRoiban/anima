type Dump = {}
local function update(self: Dump, path: PathData, node: NodeReadData): PathData
    for index = 1, #path do
        local cmd: PathCommand = path[index]
        local line = "PATH " .. tostring(index) .. " " .. cmd.type
        for j = 1, #cmd do
            local pt = cmd[j]
            line = line .. " " .. tostring(pt.x) .. "," .. tostring(pt.y)
        end
        print(line)
    end
    return path
end
return function(): PathEffect<Dump>
    return { update = update }
end
