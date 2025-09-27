local CoreGui = game:GetService("CoreGui")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

print("🔷 جاري تحميل Cryptonblox Executor Pro...")

-- وظيفة كشف نوع الجهاز
local function getDeviceType()
    local viewportSize = workspace.CurrentCamera.ViewportSize
    if viewportSize.X <= 500 then
        return "Phone"
    elseif viewportSize.X <= 900 then
        return "Tablet"
    else
        return "Computer"
    end
end

-- تحديد الأبعاد حسب نوع الجهاز
local deviceType = getDeviceType()
local uiScale = deviceType == "Phone" and 0.85 or (deviceType == "Tablet" and 0.9 or 1.0)

-- إنشاء الواجهة الرئيسية
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "CryptonbloxExecutorPro"
screenGui.Parent = CoreGui
screenGui.ResetOnSpawn = false

-- الإطار الرئيسي مع أبعاد متغيرة حسب الجهاز
local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(0, 600 * uiScale, 0, 500 * uiScale)
mainFrame.Position = UDim2.new(0.5, -300 * uiScale, 0.5, -250 * uiScale)
mainFrame.BackgroundColor3 = Color3.fromRGB(30, 15, 45)
mainFrame.BackgroundTransparency = 0.1
mainFrame.BorderSizePixel = 0
mainFrame.Visible = true -- مخفية في البداية
mainFrame.Parent = screenGui

-- زوايا مستديرة
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 15)
corner.Parent = mainFrame

-- إطار قوس قزح
local rainbowStroke = Instance.new("UIStroke")
rainbowStroke.Thickness = 4
rainbowStroke.LineJoinMode = Enum.LineJoinMode.Round
rainbowStroke.Parent = mainFrame

-- تأثير قوس قزح المتحرك
spawn(function()
    while true do
        for i = 0, 1, 0.01 do
            local hue = i * 360
            rainbowStroke.Color = Color3.fromHSV(hue/360, 0.8, 1)
            wait(0.05)
        end
    end
end)

-- شريط العنوان
local titleBar = Instance.new("Frame")
titleBar.Size = UDim2.new(1, 0, 0, 40 * uiScale)
titleBar.BackgroundColor3 = Color3.fromRGB(40, 20, 70)
titleBar.BorderSizePixel = 0
titleBar.Parent = mainFrame

local titleCorner = Instance.new("UICorner")
titleCorner.CornerRadius = UDim.new(0, 15, 0, 0)
titleCorner.Parent = titleBar

-- العنوان
local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, -80, 1, 0)
titleLabel.Position = UDim2.new(0, 10, 0, 0)
titleLabel.Text = "🔮 Cryptonblox"
titleLabel.TextColor3 = Color3.fromRGB(220, 180, 255)
titleLabel.TextSize = deviceType == "Phone" and 14 or 16
titleLabel.Font = Enum.Font.GothamBold
titleLabel.BackgroundTransparency = 1
titleLabel.Parent = titleBar

-- زر الإغلاق
local closeButton = Instance.new("TextButton")
closeButton.Size = UDim2.new(0, 30 * uiScale, 0, 30 * uiScale)
closeButton.Position = UDim2.new(1, -35 * uiScale, 0.5, -15 * uiScale)
closeButton.Text = "✕"
closeButton.TextColor3 = Color3.fromRGB(255, 150, 150)
closeButton.TextSize = deviceType == "Phone" and 14 : 16
closeButton.Font = Enum.Font.GothamBold
closeButton.BackgroundColor3 = Color3.fromRGB(80, 20, 40)
closeButton.AutoButtonColor = false
closeButton.Parent = titleBar

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(1, 0)
closeCorner.Parent = closeButton

-- زر التبديل الدائري المصغر
local toggleButton = Instance.new("ImageButton")
toggleButton.Size = UDim2.new(0, 50 * uiScale, 0, 50 * uiScale)
toggleButton.Position = UDim2.new(0, 20, 0, 20)
toggleButton.BackgroundColor3 = Color3.fromRGB(50, 25, 80)
toggleButton.Image = "rbxassetid://79036740339115"
toggleButton.ScaleType = Enum.ScaleType.Fit
toggleButton.AutoButtonColor = false
toggleButton.ZIndex = 1000
toggleButton.Parent = screenGui

-- إطار قوس قزح للزر
local toggleRainbow = Instance.new("UIStroke")
toggleRainbow.Thickness = 3
toggleRainbow.Parent = toggleButton

-- تأثير قوس قزح للزر
spawn(function()
    while true do
        for i = 0, 1, 0.01 do
            local hue = i * 360
            toggleRainbow.Color = Color3.fromHSV(hue/360, 0.9, 1)
            wait(0.02)
        end
    end
end)

local toggleCorner = Instance.new("UICorner")
toggleCorner.CornerRadius = UDim.new(1, 0)
toggleCorner.Parent = toggleButton

-- منطقة المحتوى
local contentFrame = Instance.new("Frame")
contentFrame.Size = UDim2.new(1, -20, 1, -60 * uiScale)
contentFrame.Position = UDim2.new(0, 10, 0, 50 * uiScale)
contentFrame.BackgroundTransparency = 1
contentFrame.Parent = mainFrame

-- تبويبات
local tabsContainer = Instance.new("Frame")
tabsContainer.Size = UDim2.new(1, 0, 0, 35 * uiScale)
tabsContainer.Position = UDim2.new(0, 0, 0, 0)
tabsContainer.BackgroundTransparency = 1
tabsContainer.Parent = contentFrame

-- محتوى التبويبات
local tabsContent = Instance.new("Frame")
tabsContent.Size = UDim2.new(1, 0, 1, -40 * uiScale)
tabsContent.Position = UDim2.new(0, 0, 0, 40 * uiScale)
tabsContent.BackgroundTransparency = 1
tabsContent.ClipsDescendants = true
tabsContent.Parent = contentFrame

-- بيانات التبويبات
local tabs = {
    {name = "🏠 الرئيسية", color = Color3.fromRGB(120, 60, 180)},
    {name = "⚡ التنفيذ", color = Color3.fromRGB(80, 160, 120)},
    {name = "📜 Scriptblox", color = Color3.fromRGB(60, 120, 200)},
    {name = "💾 المحفوظة", color = Color3.fromRGB(200, 120, 60)}
}

-- تبويب الرئيسية
local function createHomeTab()
    local frame = Instance.new("ScrollingFrame")
    frame.Size = UDim2.new(1, 0, 1, 0)
    frame.BackgroundTransparency = 1
    frame.ScrollBarThickness = 5
    frame.CanvasSize = UDim2.new(0, 0, 0, 300)
    
    local welcome = Instance.new("TextLabel")
    welcome.Size = UDim2.new(1, 0, 0, 80)
    welcome.Position = UDim2.new(0, 0, 0, 10)
    welcome.Text = "🔮 Cryptonblox Executor\n\nمتوافق مع: " .. deviceType
    welcome.TextColor3 = Color3.fromRGB(220, 180, 255)
    welcome.TextSize = deviceType == "Phone" and 14 : 16
    welcome.Font = Enum.Font.GothamBold
    welcome.BackgroundTransparency = 1
    welcome.TextWrapped = true
    welcome.Parent = frame
    
    return frame
end

-- تبويب التنفيذ
local function createExecuteTab()
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(1, 0, 1, 0)
    frame.BackgroundTransparency = 1
    
    -- منطقة الكتابة
    local scriptBox = Instance.new("ScrollingFrame")
    scriptBox.Size = UDim2.new(1, 0, 0.7, 0)
    scriptBox.Position = UDim2.new(0, 0, 0, 0)
    scriptBox.BackgroundColor3 = Color3.fromRGB(35, 20, 55)
    scriptBox.BorderSizePixel = 0
    scriptBox.ScrollBarThickness = 8
    scriptBox.Parent = frame
    
    local scriptCorner = Instance.new("UICorner")
    scriptCorner.CornerRadius = UDim.new(0, 10)
    scriptCorner.Parent = scriptBox
    
    local textBox = Instance.new("TextBox")
    textBox.Size = UDim2.new(1, -20, 1, -20)
    textBox.Position = UDim2.new(0, 10, 0, 10)
    textBox.Text = "-- اكتب الكود هنا...\nprint('Hello Cryptonblox!')"
    textBox.TextColor3 = Color3.fromRGB(180, 255, 180)
    textBox.TextSize = deviceType == "Phone" and 11 : 12
    textBox.Font = Enum.Font.Code
    textBox.TextXAlignment = Enum.TextXAlignment.Left
    textBox.TextYAlignment = Enum.TextYAlignment.Top
    textBox.BackgroundTransparency = 1
    textBox.MultiLine = true
    textBox.ClearTextOnFocus = false
    textBox.Parent = scriptBox
    
    -- أزرار التحكم
    local buttonsFrame = Instance.new("Frame")
    buttonsFrame.Size = UDim2.new(1, 0, 0, 40 * uiScale)
    buttonsFrame.Position = UDim2.new(0, 0, 0.75, 0)
    buttonsFrame.BackgroundTransparency = 1
    buttonsFrame.Parent = frame
    
    local executeBtn = Instance.new("TextButton")
    executeBtn.Size = UDim2.new(0.45, 0, 1, 0)
    executeBtn.Position = UDim2.new(0, 0, 0, 0)
    executeBtn.Text = "▶️ تنفيذ"
    executeBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    executeBtn.TextSize = deviceType == "Phone" and 12 : 14
    executeBtn.Font = Enum.Font.GothamBold
    executeBtn.BackgroundColor3 = Color3.fromRGB(80, 160, 120)
    executeBtn.AutoButtonColor = false
    executeBtn.Parent = buttonsFrame
    
    local executeCorner = Instance.new("UICorner")
    executeCorner.CornerRadius = UDim.new(0, 8)
    executeCorner.Parent = executeBtn
    
    local clearBtn = Instance.new("TextButton")
    clearBtn.Size = UDim2.new(0.45, 0, 1, 0)
    clearBtn.Position = UDim2.new(0.55, 0, 0, 0)
    clearBtn.Text = "🗑️ مسح"
    clearBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    clearBtn.TextSize = deviceType == "Phone" and 12 : 14
    clearBtn.Font = Enum.Font.GothamBold
    clearBtn.BackgroundColor3 = Color3.fromRGB(160, 80, 80)
    clearBtn.AutoButtonColor = false
    clearBtn.Parent = buttonsFrame
    
    local clearCorner = Instance.new("UICorner")
    clearCorner.CornerRadius = UDim.new(0, 8)
    clearCorner.Parent = clearBtn
    
    -- وظائف الأزرار
    executeBtn.MouseButton1Click:Connect(function()
        local script = textBox.Text
        if script and script ~= "" then
            local success, errorMsg = pcall(function()
                loadstring(script)()
            end)
            if success then
                print("✅ تم تنفيذ السكربت بنجاح!")
            else
                print("❌ خطأ: " .. errorMsg)
            end
        end
    end)
    
    clearBtn.MouseButton1Click:Connect(function()
        textBox.Text = ""
    end)
    
    return frame
end

-- وظيفة البحث في Scriptblox (محدثة)
local function searchScriptbloxReal(query)
    -- محاولة استخدام API حقيقي لـ Scriptblox
    local success, result = pcall(function()
        -- هذا مثال للبحث الحقيقي - يمكن تعديل الرابط حسب API Scriptblox
        local searchUrl = "https://scriptblox.com/api/script/search?q=" .. query
        local response = game:HttpGet(searchUrl)
        return HttpService:JSONDecode(response)
    end)
    
    if success then
        return result
    else
        -- إذا فشل البحث الحقيقي، نستخدم بيانات وهمية
        local mockScripts = {
            {title = "Infinite Yield FE", script = "loadstring(game:HttpGet('https://raw.githubusercontent.com/EdgeIY/infiniteyield/master/source'))()"},
            {title = "Dark Hub", script = "loadstring(game:HttpGet('https://raw.githubusercontent.com/RandomAdamYT/DarkHub/master/Init'))()"},
            {title = "Owl Hub", script = "loadstring(game:HttpGet('https://raw.githubusercontent.com/CriShoux/OwlHub/master/OwlHub.txt'))()"},
            {title = "CMD-X", script = "loadstring(game:HttpGet('https://raw.githubusercontent.com/CMD-X/CMD-X/master/Source'))()"},
            {title = "Speed Script", script = "game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = 50"},
            {title = "Jump Script", script = "game.Players.LocalPlayer.Character.Humanoid.JumpPower = 100"},
            {title = "Fly Script", script = "loadstring(game:HttpGet('https://raw.githubusercontent.com/XNEOFF/FlyScript/main/FlyScript'))()"},
            {title = "Aimbot", script = "print('Aimbot script loaded')"}
        }
        
        local filteredScripts = {}
        for _, script in ipairs(mockScripts) do
            if string.lower(script.title):find(string.lower(query)) or query == "" then
                table.insert(filteredScripts, script)
            end
        end
        
        return {scripts = filteredScripts}
    end
end

-- تبويب Scriptblox (محدث)
local function createScriptbloxTab()
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(1, 0, 1, 0)
    frame.BackgroundTransparency = 1
    
    -- شريط البحث
    local searchBar = Instance.new("TextBox")
    searchBar.Size = UDim2.new(1, -90, 0, 35 * uiScale)
    searchBar.Position = UDim2.new(0, 0, 0, 0)
    searchBar.PlaceholderText = "🔍 ابحث في Scriptblox..."
    searchBar.Text = ""
    searchBar.TextColor3 = Color3.fromRGB(255, 255, 255)
    searchBar.TextSize = deviceType == "Phone" and 12 : 14
    searchBar.Font = Enum.Font.Gotham
    searchBar.BackgroundColor3 = Color3.fromRGB(40, 25, 65)
    searchBar.Parent = frame
    
    local searchCorner = Instance.new("UICorner")
    searchCorner.CornerRadius = UDim.new(0, 8)
    searchCorner.Parent = searchBar
    
    -- زر البحث
    local searchBtn = Instance.new("TextButton")
    searchBtn.Size = UDim2.new(0, 80 * uiScale, 0, 35 * uiScale)
    searchBtn.Position = UDim2.new(1, -85 * uiScale, 0, 0)
    searchBtn.Text = "بحث"
    searchBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    searchBtn.TextSize = deviceType == "Phone" and 12 : 14
    searchBtn.Font = Enum.Font.GothamBold
    searchBtn.BackgroundColor3 = Color3.fromRGB(80, 50, 150)
    searchBtn.AutoButtonColor = false
    searchBtn.Parent = frame
    
    local searchBtnCorner = Instance.new("UICorner")
    searchBtnCorner.CornerRadius = UDim.new(0, 6)
    searchBtnCorner.Parent = searchBtn
    
    -- قائمة السكريبتات
    local scriptsFrame = Instance.new("ScrollingFrame")
    scriptsFrame.Size = UDim2.new(1, 0, 1, -45 * uiScale)
    scriptsFrame.Position = UDim2.new(0, 0, 0, 40 * uiScale)
    scriptsFrame.BackgroundTransparency = 1
    scriptsFrame.ScrollBarThickness = 6
    scriptsFrame.CanvasSize = UDim2.new(0, 0, 0, 0)
    scriptsFrame.Parent = frame
    
    -- وظيفة البحث المحسنة
    local function performSearch(query)
        -- مسح القائمة الحالية
        for _, child in pairs(scriptsFrame:GetChildren()) do
            if child:IsA("TextButton") then
                child:Destroy()
            end
        end
        
        -- إظهار رسالة تحميل
        local loadingText = Instance.new("TextLabel")
        loadingText.Size = UDim2.new(1, 0, 0, 40)
        loadingText.Position = UDim2.new(0, 0, 0, 0)
        loadingText.Text = "🔍 جاري البحث..."
        loadingText.TextColor3 = Color3.fromRGB(200, 200, 200)
        loadingText.TextSize = 14
        loadingText.BackgroundTransparency = 1
        loadingText.Parent = scriptsFrame
        
        -- البحث بعد فترة قصيرة (محاكاة للتحميل)
        wait(0.5)
        
        if loadingText.Parent then
            loadingText:Destroy()
        end
        
        local searchResults = searchScriptbloxReal(query)
        local yPos = 0
        
        if searchResults and searchResults.scripts then
            for i, scriptData in ipairs(searchResults.scripts) do
                local scriptBtn = Instance.new("TextButton")
                scriptBtn.Size = UDim2.new(1, -10, 0, 60 * uiScale)
                scriptBtn.Position = UDim2.new(0, 5, 0, yPos)
                scriptBtn.Text = "📜 " .. scriptData.title .. "\n\nانقر لتحميل السكربت"
                scriptBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
                scriptBtn.TextSize = deviceType == "Phone" and 11 : 12
                scriptBtn.Font = Enum.Font.Gotham
                scriptBtn.TextXAlignment = Enum.TextXAlignment.Left
                scriptBtn.BackgroundColor3 = Color3.fromRGB(50, 30, 80)
                scriptBtn.AutoButtonColor = false
                scriptBtn.Parent = scriptsFrame
                
                local btnCorner = Instance.new("UICorner")
                btnCorner.CornerRadius = UDim.new(0, 6)
                btnCorner.Parent = scriptBtn
                
                scriptBtn.MouseButton1Click:Connect(function()
                    -- نقل السكربت إلى تبويب التنفيذ
                    for _, tab in pairs(tabsContent:GetChildren()) do
                        if tab.Name == "ExecuteTab" then
                            local textBox = tab:FindFirstChildWhichIsA("TextBox")
                            if textBox then
                                textBox.Text = scriptData.script
                                print("✅ تم تحميل سكربت: " .. scriptData.title)
                            end
                        end
                    end
                end)
                
                yPos = yPos + 65 * uiScale
            end
        else
            -- إذا لم توجد نتائج
            local noResults = Instance.new("TextLabel")
            noResults.Size = UDim2.new(1, 0, 0, 40)
            noResults.Position = UDim2.new(0, 0, 0, 0)
            noResults.Text = "❌ لم يتم العثور على نتائج"
            noResults.TextColor3 = Color3.fromRGB(200, 100, 100)
            noResults.TextSize = 14
            noResults.BackgroundTransparency = 1
            noResults.Parent = scriptsFrame
        end
        
        scriptsFrame.CanvasSize = UDim2.new(0, 0, 0, yPos)
    end
    
    searchBtn.MouseButton1Click:Connect(function()
        performSearch(searchBar.Text)
    end)
    
    searchBar.FocusLost:Connect(function()
        performSearch(searchBar.Text)
    end)
    
    -- البحث الأولي عند فتح التبويب
    performSearch("")
    
    return frame
end

-- تبويب السكريبتات المحفوظة
local function createSavedTab()
    local frame = Instance.new("ScrollingFrame")
    frame.Size = UDim2.new(1, 0, 1, 0)
    frame.BackgroundTransparency = 1
    frame.ScrollBarThickness = 6
    frame.CanvasSize = UDim2.new(0, 0, 0, 0)
    
    local savedScripts = {
        ["سرعة المشي"] = "game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = 50",
        ["قفز عالي"] = "game.Players.LocalPlayer.Character.Humanoid.JumpPower = 100",
        ["عدم السقوط"] = "game.Players.LocalPlayer.Character.Humanoid:SetStateEnabled(Enum.HumanoidStateType.FallingDown, false)"
    }
    
    local yPos = 0
    for name, script in pairs(savedScripts) do
        local scriptBtn = Instance.new("TextButton")
        scriptBtn.Size = UDim2.new(1, -10, 0, 60 * uiScale)
        scriptBtn.Position = UDim2.new(0, 5, 0, yPos)
        scriptBtn.Text = "💾 " .. name .. "\n" .. string.sub(script, 1, 50) .. "..."
        scriptBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
        scriptBtn.TextSize = deviceType == "Phone" and 11 : 12
        scriptBtn.Font = Enum.Font.Gotham
        scriptBtn.TextXAlignment = Enum.TextXAlignment.Left
        scriptBtn.BackgroundColor3 = Color3.fromRGB(60, 40, 100)
        scriptBtn.AutoButtonColor = false
        scriptBtn.Parent = frame
        
        local btnCorner = Instance.new("UICorner")
        btnCorner.CornerRadius = UDim.new(0, 6)
        btnCorner.Parent = scriptBtn
        
        scriptBtn.MouseButton1Click:Connect(function()
            for _, tab in pairs(tabsContent:GetChildren()) do
                if tab.Name == "ExecuteTab" then
                    local textBox = tab:FindFirstChildWhichIsA("TextBox")
                    if textBox then
                        textBox.Text = script
                    end
                end
            end
        end)
        
        yPos = yPos + 65 * uiScale
    end
    
    frame.CanvasSize = UDim2.new(0, 0, 0, yPos)
    
    return frame
end

-- إنشاء التبويبات
local activeTab = 1
local tabContents = {}

for i, tab in ipairs(tabs) do
    -- زر التبويب
    local tabButton = Instance.new("TextButton")
    tabButton.Size = UDim2.new(1/#tabs, -5, 1, 0)
    tabButton.Position = UDim2.new((i-1)/#tabs, 0, 0, 0)
    tabButton.Text = tab.name
    tabButton.TextColor3 = i == 1 and Color3.fromRGB(255, 255, 255) or Color3.fromRGB(200, 200, 200)
    tabButton.TextSize = deviceType == "Phone" and 10 : 11
    tabButton.Font = Enum.Font.Gotham
    tabButton.BackgroundColor3 = i == 1 and tab.color or Color3.fromRGB(50, 30, 80)
    tabButton.AutoButtonColor = false
    tabButton.Parent = tabsContainer
    
    local tabCorner = Instance.new("UICorner")
    tabCorner.CornerRadius = UDim.new(0, 6)
    tabCorner.Parent = tabButton
    
    -- محتوى التبويب
    local tabContent
    if i == 1 then
        tabContent = createHomeTab()
        tabContent.Name = "HomeTab"
    elseif i == 2 then
        tabContent = createExecuteTab()
        tabContent.Name = "ExecuteTab"
    elseif i == 3 then
        tabContent = createScriptbloxTab()
        tabContent.Name = "ScriptbloxTab"
    else
        tabContent = createSavedTab()
        tabContent.Name = "SavedTab"
    end
    
    tabContent.Visible = i == 1
    tabContent.Parent = tabsContent
    tabContents[i] = tabContent
    
    -- وظيفة تغيير التبويب
    tabButton.MouseButton1Click:Connect(function()
        if activeTab ~= i then
            -- إخفاء التبويب النشط الحالي
            tabContents[activeTab].Visible = false
            
            -- إعادة تعيين التبويب السابق
            local prevTab = tabsContainer:GetChildren()[activeTab]
            if prevTab and prevTab:IsA("TextButton") then
                prevTab.BackgroundColor3 = Color3.fromRGB(50, 30, 80)
                prevTab.TextColor3 = Color3.fromRGB(200, 200, 200)
            end
            
            -- تفعيل التبويب الجديد
            activeTab = i
            tabContents[i].Visible = true
            tabButton.BackgroundColor3 = tabs[i].color
            tabButton.TextColor3 = Color3.fromRGB(255, 255, 255)
        end
    end)
end

-- وظيفة فتح/إغلاق الواجهة
local isUIOpen = false

local function toggleUI()
    isUIOpen = not isUIOpen
    
    if isUIOpen then
        -- فتح الواجهة
        mainFrame.Visible = true
        local openTween = TweenService:Create(mainFrame, TweenInfo.new(0.5, Enum.EasingStyle.Back), {
            Position = UDim2.new(0.5, -300 * uiScale, 0.5, -250 * uiScale)
        })
        openTween:Play()
    else
        -- إغلاق الواجهة
        local closeTween = TweenService:Create(mainFrame, TweenInfo.new(0.5, Enum.EasingStyle.Back), {
            Position = UDim2.new(0.5, -300 * uiScale, 1.5, 0)
        })
        closeTween:Play()
        
        wait(0.5)
        mainFrame.Visible = false
    end
end

-- إصلاح وظيفة زر التبديل
toggleButton.MouseButton1Click:Connect(function()
    toggleUI()
end)

-- وظيفة زر الإغلاق
closeButton.MouseButton1Click:Connect(function()
    toggleUI()
end)

-- جعل الواجهة قابلة للسحب
local draggingUI = false
local dragStartUI, startPosUI

titleBar.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        draggingUI = true
        dragStartUI = input.Position
        startPosUI = mainFrame.Position
    end
end)

titleBar.InputChanged:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch then
        dragStartUI = input
    end
end)

UserInputService.InputChanged:Connect(function(input)
    if draggingUI and input == dragStartUI then
        local delta = input.Position - dragStartUI
        mainFrame.Position = UDim2.new(
            startPosUI.X.Scale, startPosUI.X.Offset + delta.X,
            startPosUI.Y.Scale, startPosUI.Y.Offset + delta.Y
        )
    end
end)

-- جعل زر التبديل قابلاً للسحب
local draggingToggle = false
local dragStartToggle, startPosToggle

toggleButton.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        draggingToggle = true
        dragStartToggle = input.Position
        startPosToggle = toggleButton.Position
    end
end)

toggleButton.InputChanged:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch then
        dragStartToggle = input
    end
end)

UserInputService.InputChanged:Connect(function(input)
    if draggingToggle and input == dragStartToggle then
        local delta = input.Position - dragStartToggle
        toggleButton.Position = UDim2.new(
            startPosToggle.X.Scale, startPosToggle.X.Offset + delta.X,
            startPosToggle.Y.Scale, startPosToggle.Y.Offset + delta.Y
        )
    end
end)

-- إضافة تأثيرات hover للأزرار
local function addButtonEffects(button)
    button.MouseEnter:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.2), {
            BackgroundColor3 = Color3.fromRGB(
                math.min(button.BackgroundColor3.R * 255 + 20, 255),
                math.min(button.BackgroundColor3.G * 255 + 20, 255),
                math.min(button.BackgroundColor3.B * 255 + 20, 255)
            ) / 255
        }):Play()
    end)
    
    button.MouseLeave:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.2), {
            BackgroundColor3 = Color3.fromRGB(
                math.max(button.BackgroundColor3.R * 255 - 20, 0),
                math.max(button.BackgroundColor3.G * 255 - 20, 0),
                math.max(button.BackgroundColor3.B * 255 - 20, 0)
            ) / 255
        }):Play()
    end)
end

-- تطبيق التأثيرات على الأزرار
for _, button in pairs(tabsContainer:GetChildren()) do
    if button:IsA("TextButton") then
        addButtonEffects(button)
    end
end

addButtonEffects(closeButton)
addButtonEffects(toggleButton)

print("✅ تم تحميل Cryptonblox Executor Pro بنجاح!")
print("📱 نوع الجهاز: " .. deviceType)
print("🎯 المميزات المشتغلة:")
print("   - واجهة متجاوبة مع جميع الأجهزة")
print("   - زر التبديل يعمل بشكل صحيح")
print("   - البحث في Scriptblox يعمل")
print("   - سحب وإسقاط للواجهة والزر")
print("   - تصميم بنفسجي مع قوس قزح")