--!strict

local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")

local RobloxUILibrary = {}
RobloxUILibrary.__index = RobloxUILibrary

--// Constants
local DEFAULT_THEME = "Dark"
local THEMES = {
    Light = {
        --// Frames:
        Primary = Color3.fromRGB(232, 232, 232),
        Secondary = Color3.fromRGB(255, 255, 255),
        Component = Color3.fromRGB(245, 245, 245),
        Interactables = Color3.fromRGB(235, 235, 235),

        --// Text:
        Tab = Color3.fromRGB(50, 50, 50),
        Title = Color3.fromRGB(0, 0, 0),
        Description = Color3.fromRGB(100, 100, 100),

        --// Outlines:
        Shadow = Color3.fromRGB(255, 255, 255),
        Outline = Color3.fromRGB(210, 210, 210),

        --// Image:
        Icon = Color3.fromRGB(100, 100, 100),
    },
    Dark = {
        --// Frames:
        Primary = Color3.fromRGB(30, 30, 30),
        Secondary = Color3.fromRGB(35, 35, 35),
        Component = Color3.fromRGB(40, 40, 40),
        Interactables = Color3.fromRGB(45, 45, 45),

        --// Text:
        Tab = Color3.fromRGB(200, 200, 200),
        Title = Color3.fromRGB(240, 240, 240),
        Description = Color3.fromRGB(200, 200, 200),

        --// Outlines:
        Shadow = Color3.fromRGB(0, 0, 0),
        Outline = Color3.fromRGB(40, 40, 40),

        --// Image:
        Icon = Color3.fromRGB(220, 220, 220),
    },
    Void = {
        --// Frames:
        Primary = Color3.fromRGB(15, 15, 15),
        Secondary = Color3.fromRGB(20, 20, 20),
        Component = Color3.fromRGB(25, 25, 25),
        Interactables = Color3.fromRGB(30, 30, 30),

        --// Text:
        Tab = Color3.fromRGB(200, 200, 200),
        Title = Color3.fromRGB(240, 240, 240),
        Description = Color3.fromRGB(200, 200, 200),

        --// Outlines:
        Shadow = Color3.fromRGB(0, 0, 0),
        Outline = Color3.fromRGB(40, 40, 40),

        --// Image:
        Icon = Color3.fromRGB(220, 220, 220),
    },
}

--// Utility Functions
local function create(className: string, properties: {}) 
    local instance = Instance.new(className)
    for prop, value in pairs(properties) do
        instance[prop] = value
    end
    return instance
end

local function applyTheme(instance: Instance, themeName: string, themeTable: {}) 
    if instance:IsA("Frame") or instance:IsA("TextButton") or instance:IsA("TextBox") or instance:IsA("ImageLabel") then
        if instance.Name == "MainFrame" then
            instance.BackgroundColor3 = themeTable.Primary
            if instance:FindFirstChildOfClass("UIStroke") then
                instance:FindFirstChildOfClass("UIStroke").Color = themeTable.Outline
            end
        elseif instance.Name == "TitleBar" then
            instance.BackgroundColor3 = themeTable.Secondary
        elseif instance.Name == "TitleLabel" then
            instance.TextColor3 = themeTable.Title
        elseif instance.Name == "MinimizeButton" then
            instance.BackgroundColor3 = themeTable.Interactables
            instance.TextColor3 = themeTable.Title
        elseif instance.Name == "TabSectionContainer" then
            instance.BackgroundColor3 = themeTable.Secondary
        elseif instance.Name == "ContentContainer" then
            instance.BackgroundColor3 = themeTable.Component
        elseif instance.Name == "Icon" and instance:IsA("ImageLabel") then
            instance.ImageColor3 = themeTable.Icon
        elseif instance.Name == "Title" and instance:IsA("TextLabel") then
            instance.TextColor3 = themeTable.Title
        elseif instance.Name == "Description" and instance:IsA("TextLabel") then
            instance.TextColor3 = themeTable.Description
        elseif instance.Name == "TextBox" and instance:IsA("TextBox") then
            instance.BackgroundColor3 = themeTable.Component
            instance.TextColor3 = themeTable.Title
            instance.PlaceholderColor3 = themeTable.Description
        elseif instance.Name == "KeybindButton" and instance:IsA("TextButton") then
            instance.BackgroundColor3 = themeTable.Component
            instance.TextColor3 = themeTable.Title
        elseif instance.Name == "ColorDisplay" and instance:IsA("TextButton") then
            -- ColorDisplay's background is set by the user's chosen color, not theme
        elseif instance.Name == "ToggleButton" and instance:IsA("TextButton") then
            -- ToggleButton's background is set by its state (ON/OFF), not theme
        elseif instance.Name == "SliderBar" then
            instance.BackgroundColor3 = themeTable.Component
        elseif instance.Name == "SliderFill" then
            instance.BackgroundColor3 = themeTable.Title
        elseif instance.Name == "SliderHandle" then
            instance.ImageColor3 = themeTable.Title
        elseif instance.Name == "ValueLabel" then
            instance.TextColor3 = themeTable.Title
        elseif instance.Name == "DropdownButton" then
            instance.BackgroundColor3 = themeTable.Component
            instance.TextColor3 = themeTable.Title
        elseif instance.Name == "DropdownList" then
            instance.BackgroundColor3 = themeTable.Component
        elseif instance.Name:match("Item$") and instance:IsA("TextButton") then
            instance.BackgroundColor3 = themeTable.Component
            instance.TextColor3 = themeTable.Title
        elseif instance.Name == "Notification" then
            instance.BackgroundColor3 = themeTable.Component
            if instance:FindFirstChildOfClass("UIStroke") then
                instance:FindFirstChildOfClass("UIStroke").Color = themeTable.Outline
            end
        else
            -- Default for other interactable elements
            if instance:IsA("TextButton") or instance:IsA("Frame") then
                instance.BackgroundColor3 = themeTable.Interactables
            end
        end
    end

    for _, child in pairs(instance:GetChildren()) do
        applyTheme(child, themeName, themeTable)
    end
end

--// Library Core
function RobloxUILibrary:CreateWindow(options: {
    Title: string,
    Theme: string,
    Size: UDim2,
    Transparency: number,
    Blurring: boolean,
    MinimizeKeybind: Enum.KeyCode,
}) : any
    local self = setmetatable({}, RobloxUILibrary)

    self.Options = options
    self.CurrentTheme = THEMES[options.Theme] or THEMES[DEFAULT_THEME]
    self.Elements = {}
    self.Sections = {}
    self.Tabs = {}

    -- Create ScreenGui
    self.ScreenGui = create("ScreenGui", {
        Name = "RobloxUILibrary",
        Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui"),
        ResetOnSpawn = false,
    })

    -- Create Main Frame
    self.MainFrame = create("Frame", {
        Name = "MainFrame",
        Size = options.Size,
        Position = UDim2.new(0.5, 0, 0.5, 0),
        AnchorPoint = Vector2.new(0.5, 0.5),
        BackgroundColor3 = self.CurrentTheme.Primary,
        BackgroundTransparency = options.Transparency,
        BorderSizePixel = 0,
        ClipsDescendants = true,
        Parent = self.ScreenGui,
    })

    -- Add UI Corner
    create("UICorner", {
        CornerRadius = UDim.new(0, 8),
        Parent = self.MainFrame,
    })

    -- Add UI Stroke for outline
    create("UIStroke", {
        Color = self.CurrentTheme.Outline,
        Thickness = 1,
        ApplyStrokeMode = Enum.UIStrokeApplyMode.Border,
        Parent = self.MainFrame,
    })

    -- Add Title Bar
    self.TitleBar = create("Frame", {
        Name = "TitleBar",
        Size = UDim2.new(1, 0, 0, 30),
        BackgroundColor3 = self.CurrentTheme.Secondary,
        BackgroundTransparency = options.Transparency,
        BorderSizePixel = 0,
        Parent = self.MainFrame,
    })

    create("TextLabel", {
        Name = "TitleLabel",
        Size = UDim2.new(1, -60, 1, 0),
        Position = UDim2.new(0, 30, 0, 0),
        BackgroundColor3 = self.CurrentTheme.Secondary,
        BackgroundTransparency = 1,
        Text = options.Title,
        TextColor3 = self.CurrentTheme.Title,
        Font = Enum.Font.GothamBold,
        TextSize = 18,
        TextXAlignment = Enum.TextXAlignment.Left,
        Parent = self.TitleBar,
    })

    -- Draggable functionality
    local dragging = false
    local dragInputStart: Vector2
    local framePositionStart: UDim2

    self.TitleBar.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
            dragging = true
            dragInputStart = input.Position
            framePositionStart = self.MainFrame.Position
        end
    end)

    self.TitleBar.InputEnded:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
            dragging = false
        end
    end)

    UserInputService.InputChanged:Connect(function(input)
        if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
            local delta = input.Position - dragInputStart
            self.MainFrame.Position = UDim2.new(
                framePositionStart.X.Scale, framePositionStart.X.Offset + delta.X,
                framePositionStart.Y.Scale, framePositionStart.Y.Offset + delta.Y
            )
        end
    end)

    -- Minimize/Maximize Button (Placeholder for now)
    self.MinimizeButton = create("TextButton", {
        Name = "MinimizeButton",
        Size = UDim2.new(0, 30, 1, 0),
        Position = UDim2.new(1, -30, 0, 0),
        BackgroundColor3 = self.CurrentTheme.Interactables,
        BackgroundTransparency = options.Transparency,
        Text = "_",
        TextColor3 = self.CurrentTheme.Title,
        Font = Enum.Font.GothamBold,
        TextSize = 20,
        Parent = self.TitleBar,
    })

    -- Tab Section Container
    self.TabSectionContainer = create("Frame", {
        Name = "TabSectionContainer",
        Size = UDim2.new(0, 150, 1, -30),
        Position = UDim2.new(0, 0, 0, 30),
        BackgroundColor3 = self.CurrentTheme.Secondary,
        BackgroundTransparency = options.Transparency,
        BorderSizePixel = 0,
        Parent = self.MainFrame,
    })

    -- Content Container
    self.ContentContainer = create("Frame", {
        Name = "ContentContainer",
        Size = UDim2.new(1, -150, 1, -30),
        Position = UDim2.new(0, 150, 0, 30),
        BackgroundColor3 = self.CurrentTheme.Component,
        BackgroundTransparency = options.Transparency,
        BorderSizePixel = 0,
        Parent = self.MainFrame,
    })

    -- Add Blur effect if blurring is true
    if options.Blurring then
        local blur = create("BlurEffect", {
            Size = 24,
            Parent = game:GetService("Lighting"),
        })
        self.ScreenGui.Destroying:Connect(function() blur:Destroy() end)
    end

    -- Method to set theme
    function self:SetTheme(themeName: string)
        local newTheme = THEMES[themeName]
        if newTheme then
            self.CurrentTheme = newTheme
            -- Apply theme to existing elements (this will be expanded)
            self.MainFrame.BackgroundColor3 = newTheme.Primary
            self.TitleBar.BackgroundColor3 = newTheme.Secondary
            self.TitleBar.TitleLabel.TextColor3 = newTheme.Title
            self.MinimizeButton.BackgroundColor3 = newTheme.Interactables
            self.MinimizeButton.TextColor3 = newTheme.Title
            self.TabSectionContainer.BackgroundColor3 = newTheme.Secondary
            self.ContentContainer.BackgroundColor3 = newTheme.Component
            self.MainFrame.UIStroke.Color = newTheme.Outline
            -- Re-apply theme to all child elements recursively
            applyTheme(self.MainFrame, themeName, newTheme)
            -- Re-apply theme to all tabs to ensure active state is correct
            for _, tabData in pairs(self.Tabs) do
                if self.ActiveTab == tabData.Title then
                    tabData.Button.BackgroundColor3 = newTheme.Primary
                    tabData.Button.Title.TextColor3 = newTheme.Title
                    tabData.Button.Icon.ImageColor3 = newTheme.Title
                else
                    tabData.Button.BackgroundColor3 = newTheme.Interactables
                    tabData.Button.Title.TextColor3 = newTheme.Tab
                    tabData.Button.Icon.ImageColor3 = newTheme.Icon
                end
            end
        end
    end

    -- Method to add a tab section
    function self:AddTabSection(options: {
        Name: string,
        Order: number,
    })
        local sectionFrame = create("Frame", {
            Name = options.Name,
            Size = UDim2.new(1, 0, 0, 0), -- Size will be managed by UILayout
            BackgroundColor3 = self.CurrentTheme.Secondary,
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
            Parent = self.TabSectionContainer,
        })
        self.Sections[options.Name] = sectionFrame

        -- Add UILayout to manage sections
        if not self.TabSectionContainer:FindFirstChildOfClass("UIListLayout") then
            create("UIListLayout", {
                FillDirection = Enum.FillDirection.Vertical,
                HorizontalAlignment = Enum.HorizontalAlignment.Center,
                VerticalAlignment = Enum.VerticalAlignment.Top,
                Padding = UDim.new(0, 5),
                Parent = self.TabSectionContainer,
            })
        end

        return sectionFrame
    end

    -- Method to add a tab
    function self:AddTab(options: {
        Title: string,
        Section: string,
        Icon: string, -- rbxassetid or path to image
    })
        local sectionFrame = self.Sections[options.Section]
        if not sectionFrame then
            warn("Tab section " .. options.Section .. " not found.")
            return
        end

        local tabButton = create("TextButton", {
            Name = options.Title .. "Tab",
            Size = UDim2.new(1, -10, 0, 40),
            Position = UDim2.new(0.5, 0, 0, 0), -- Managed by UILayout
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            Text = "",
            BorderSizePixel = 0,
            Parent = sectionFrame,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = tabButton,
        })

        create("ImageLabel", {
            Name = "Icon",
            Size = UDim2.new(0, 24, 0, 24),
            Position = UDim2.new(0, 10, 0.5, 0),
            AnchorPoint = Vector2.new(0, 0.5),
            BackgroundTransparency = 1,
            Image = options.Icon,
            ImageColor3 = self.CurrentTheme.Icon,
            Parent = tabButton,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -40, 1, 0),
            Position = UDim2.new(0, 40, 0, 0),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Tab,
            Font = Enum.Font.Gotham,
            TextSize = 16,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = tabButton,
        })

        -- Tab content frame
        local tabContentFrame = create("Frame", {
            Name = options.Title .. "Content",
            Size = UDim2.new(1, 0, 1, 0),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
            Visible = false, -- Hidden by default
             self.Tabs[options.Title] = {
            Button = tabButton,
            Content = tabContentFrame,
            Elements = {}, -- To store elements added to this tab
        }

        -- Tab activation logic
        tabButton.MouseButton1Click:Connect(function()
            for _, tab in pairs(self.Tabs) do
                tab.Content.Visible = false
                tab.Button.BackgroundColor3 = self.CurrentTheme.Interactables
                tab.Button.Title.TextColor3 = self.CurrentTheme.Tab
                tab.Button.Icon.ImageColor3 = self.CurrentTheme.Icon
            end
            tabContentFrame.Visible = true
            tabButton.BackgroundColor3 = self.CurrentTheme.Primary
            tabButton.Title.TextColor3 = self.CurrentTheme.Title
            tabButton.Icon.ImageColor3 = self.CurrentTheme.Title
            self.ActiveTab = options.Title
        end)

        -- Activate the first tab by default
        if not self.ActiveTab then
            self.ActiveTab = options.Title
            tabButton.MouseButton1Click:Fire()
        end

        -- Add a UIListLayout to the tab content frame for automatic arrangement
        create("UIListLayout", {
            FillDirection = Enum.FillDirection.Vertical,
            HorizontalAlignment = Enum.HorizontalAlignment.Center,
            VerticalAlignment = Enum.VerticalAlignment.Top,
            Padding = UDim.new(0, 10),
            Parent = tabContentFrame,
        })

        -- Add a scrolling frame to the tab content
        local scrollingFrame = create("ScrollingFrame", {
            Name = "ScrollingContent",
            Size = UDim2.new(1, -20, 1, -20),
            Position = UDim2.new(0.5, 0, 0.5, 0),
            AnchorPoint = Vector2.new(0.5, 0.5),
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
            CanvasSize = UDim2.new(0, 0, 0, 0), -- Will be updated dynamically
            AutomaticCanvasSize = Enum.AutomaticSize.Y,
            ScrollingDirection = Enum.ScrollingDirection.Y,
            Parent = tabContentFrame,
        })

        -- Move the UIListLayout to the scrolling frame
        tabContentFrame:FindFirstChildOfClass("UIListLayout").Parent = scrollingFrame

        -- Update the tab content frame to point to the scrolling frame for adding elements
        self.Tabs[options.Title].Content = scrollingFrame

        return self.Tabs[options.Title]
    endion within a tab
    function self:AddSection(options: {
        Name: string,
        Tab: any, -- The tab object returned by AddTab
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for section " .. options.Name .. ".")
            return
        end

        local sectionFrame = create("Frame", {
            Name = options.Name .. "Section",
            Size = UDim2.new(1, -20, 0, 0), -- Height will be managed by UILayout
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("TextLabel", {
            Name = "SectionTitle",
            Size = UDim2.new(1, 0, 0, 25),
            Position = UDim2.new(0, 0, 0, 0),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 1,
            Text = options.Name,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 16,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = sectionFrame,
        })

        local contentFrame = create("Frame", {
            Name = "Content",
            Size = UDim2.new(1, 0, 1, -25),
            Position = UDim2.new(0, 0, 0, 25),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
            Parent = sectionFrame,
        })

        -- Add UILayout to manage elements within the section
        create("UIListLayout", {
            FillDirection = Enum.FillDirection.Vertical,
            HorizontalAlignment = Enum.HorizontalAlignment.Left,
            VerticalAlignment = Enum.VerticalAlignment.Top,
            Padding = UDim.new(0, 5),
            Parent = contentFrame,
        })

        -- Store elements in the tab's elements table
        table.insert(options.Tab.Elements, sectionFrame)

        return { Frame = sectionFrame, Content = contentFrame }
    end

    -- Method to add a paragraph
    function self:AddParagraph(options: {
        Title: string,
        Description: string,
        Tab: any,
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for paragraph " .. options.Title .. ".")
            return
        end

        local paragraphFrame = create("Frame", {
            Name = options.Title .. "Paragraph",
            Size = UDim2.new(1, -20, 0, 0), -- Height will be managed by UILayout
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 1,
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, 0, 0, 20),
            Position = UDim2.new(0, 0, 0, 0),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = paragraphFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, 0, 0, 40),
            Position = UDim2.new(0, 0, 0, 20),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 13,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = paragraphFrame,
        })

        -- Add UILayout to manage elements within the paragraph frame
        create("UIListLayout", {
            FillDirection = Enum.FillDirection.Vertical,
            HorizontalAlignment = Enum.HorizontalAlignment.Left,
            VerticalAlignment = Enum.VerticalAlignment.Top,
            Padding = UDim.new(0, 5),
            Parent = paragraphFrame,
        })

        table.insert(options.Tab.Elements, paragraphFrame)

        return paragraphFrame
    end

    -- Method to add a button
    function self:AddButton(options: {
        Title: string,
        Description: string,
        Tab: any,
        Callback: () -> (),
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for button " .. options.Title .. ".")
            return
        end

        local buttonFrame = create("TextButton", {
            Name = options.Title .. "Button",
            Size = UDim2.new(1, -20, 0, 60),
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            Text = "",
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = buttonFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 10),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = buttonFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 30),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 13,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = buttonFrame,
        })

        buttonFrame.MouseButton1Click:Connect(options.Callback)

        table.insert(options.Tab.Elements, buttonFrame)

        return buttonFrame
    end

    -- Method to add a notification system
    function self:Notify(options: {
        Title: string,
        Description: string,
        Duration: number,
    })
        local notificationFrame = create("Frame", {
            Name = "Notification",
            Size = UDim2.new(0, 300, 0, 80),
            Position = UDim2.new(1, -310, 0, 10), -- Top right corner
            AnchorPoint = Vector2.new(1, 0),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            ClipsDescendants = true,
            Parent = self.ScreenGui,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 8),
            Parent = notificationFrame,
        })

        create("UIStroke", {
            Color = self.CurrentTheme.Outline,
            Thickness = 1,
            ApplyStrokeMode = Enum.UIStrokeApplyMode.Border,
            Parent = notificationFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 10),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 16,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = notificationFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -20, 0, 40),
            Position = UDim2.new(0, 10, 0, 30),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 14,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = notificationFrame,
        })

        -- Animation for notification
        local startPos = UDim2.new(1, -310, 0, 10)
        local endPos = UDim2.new(1, -10, 0, 10)
        local tweenInfo = TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)

        local showTween = TweenService:Create(notificationFrame, tweenInfo, {Position = endPos})
        showTween:Play()

        task.delay(options.Duration, function()
            local hideTween = TweenService:Create(notificationFrame, tweenInfo, {Position = startPos})
            hideTween:Play()
            hideTween.Completed:Wait()
            notificationFrame:Destroy()
        end)

        return notificationFrame
    end

    return self
end

return RobloxUILibrary


    -- Method to add an input field
    function self:AddInput(options: {
        Title: string,
        Description: string,
        Tab: any,
        Placeholder: string,
        Default: string,
        Callback: (text: string) -> (),
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for input " .. options.Title .. ".")
            return
        end

        local inputFrame = create("Frame", {
            Name = options.Title .. "Input",
            Size = UDim2.new(1, -20, 0, 70),
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = inputFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 5),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = inputFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -20, 0, 15),
            Position = UDim2.new(0, 10, 0, 25),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 12,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = inputFrame,
        })

        local textBox = create("TextBox", {
            Name = "TextBox",
            Size = UDim2.new(1, -20, 0, 25),
            Position = UDim2.new(0, 10, 0, 45),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Text = options.Default or "",
            PlaceholderText = options.Placeholder or "",
            PlaceholderColor3 = self.CurrentTheme.Description,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.Gotham,
            TextSize = 14,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = inputFrame,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 4),
            Parent = textBox,
        })

        textBox.FocusLost:Connect(function(enterPressed)
            if enterPressed then
                options.Callback(textBox.Text)
            end
        end)

        table.insert(options.Tab.Elements, inputFrame)

        return inputFrame
    end

    -- Method to add a keybind picker
    function self:AddKeybind(options: {
        Title: string,
        Description: string,
        Tab: any,
        Default: Enum.KeyCode,
        Callback: (keyCode: Enum.KeyCode) -> (),
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for keybind " .. options.Title .. ".")
            return
        end

        local keybindFrame = create("Frame", {
            Name = options.Title .. "Keybind",
            Size = UDim2.new(1, -20, 0, 70),
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = keybindFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 5),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = keybindFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -20, 0, 15),
            Position = UDim2.new(0, 10, 0, 25),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 12,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = keybindFrame,
        })

        local keybindButton = create("TextButton", {
            Name = "KeybindButton",
            Size = UDim2.new(1, -20, 0, 25),
            Position = UDim2.new(0, 10, 0, 45),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Text = options.Default.Name,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.Gotham,
            TextSize = 14,
            TextXAlignment = Enum.TextXAlignment.Center,
            Parent = keybindFrame,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 4),
            Parent = keybindButton,
        })

        local listening = false
        keybindButton.MouseButton1Click:Connect(function()
            listening = not listening
            if listening then
                keybindButton.Text = "... Press a key ..."
                keybindButton.TextColor3 = Color3.fromRGB(255, 255, 0) -- Yellow to indicate listening
            else
                keybindButton.Text = options.Default.Name
                keybindButton.TextColor3 = self.CurrentTheme.Title
            end
        end)

        UserInputService.InputBegan:Connect(function(input, gameProcessedEvent)
            if listening and not gameProcessedEvent and input.UserInputType == Enum.UserInputType.Keyboard then
                listening = false
                keybindButton.Text = input.KeyCode.Name
                keybindButton.TextColor3 = self.CurrentTheme.Title
                options.Callback(input.KeyCode)
            end
        end)

        table.insert(options.Tab.Elements, keybindFrame)

        return keybindFrame
    end

    -- Method to add a color picker (simplified for demonstration)
    function self:AddColorPicker(options: {
        Title: string,
        Description: string,
        Tab: any,
        Default: Color3,
        Callback: (color: Color3) -> (),
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for color picker " .. options.Title .. ".")
            return
        end

        local colorPickerFrame = create("Frame", {
            Name = options.Title .. "ColorPicker",
            Size = UDim2.new(1, -20, 0, 70),
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = colorPickerFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 5),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = colorPickerFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -20, 0, 15),
            Position = UDim2.new(0, 10, 0, 25),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 12,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = colorPickerFrame,
        })

        local colorDisplay = create("TextButton", {
            Name = "ColorDisplay",
            Size = UDim2.new(0, 50, 0, 25),
            Position = UDim2.new(1, -60, 0, 45),
            AnchorPoint = Vector2.new(1, 0),
            BackgroundColor3 = options.Default,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Text = "",
            Parent = colorPickerFrame,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 4),
            Parent = colorDisplay,
        })

        -- Simplified color picker: cycles through a few colors on click
        local colors = {Color3.fromRGB(255,0,0), Color3.fromRGB(0,255,0), Color3.fromRGB(0,0,255), Color3.fromRGB(255,255,0)}
        local currentColorIndex = 1

        colorDisplay.MouseButton1Click:Connect(function()
            currentColorIndex = currentColorIndex % #colors + 1
            local newColor = colors[currentColorIndex]
            colorDisplay.BackgroundColor3 = newColor
            options.Callback(newColor)
        end)

        table.insert(options.Tab.Elements, colorPickerFrame)

        return colorPickerFrame
    end

    -- Method to add a toggle switch
    function self:AddToggle(options: {
        Title: string,
        Description: string,
        Tab: any,
        Default: boolean,
        Callback: (value: boolean) -> (),
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for toggle " .. options.Title .. ".")
            return
        end

        local toggleFrame = create("Frame", {
            Name = options.Title .. "Toggle",
            Size = UDim2.new(1, -20, 0, 60),
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = toggleFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -70, 0, 20),
            Position = UDim2.new(0, 10, 0, 10),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = toggleFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -70, 0, 20),
            Position = UDim2.new(0, 10, 0, 30),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 13,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = toggleFrame,
        })

        local toggleButton = create("TextButton", {
            Name = "ToggleButton",
            Size = UDim2.new(0, 50, 0, 25),
            Position = UDim2.new(1, -60, 0.5, 0),
            AnchorPoint = Vector2.new(1, 0.5),
            BackgroundColor3 = options.Default and Color3.fromRGB(0, 200, 0) or Color3.fromRGB(200, 0, 0),
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Text = options.Default and "ON" or "OFF",
            TextColor3 = Color3.fromRGB(255, 255, 255),
            Font = Enum.Font.GothamBold,
            TextSize = 14,
            Parent = toggleFrame,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 12),
            Parent = toggleButton,
        })

        local currentValue = options.Default
        toggleButton.MouseButton1Click:Connect(function()
            currentValue = not currentValue
            if currentValue then
                toggleButton.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
                toggleButton.Text = "ON"
            else
                toggleButton.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
                toggleButton.Text = "OFF"
            end
            options.Callback(currentValue)
        end)

        table.insert(options.Tab.Elements, toggleFrame)

        return toggleFrame
    end

    -- Method to add a slider
    function self:AddSlider(options: {
        Title: string,
        Description: string,
        Tab: any,
        Min: number,
        Max: number,
        Default: number,
        Step: number,
        Callback: (value: number) -> (),
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for slider " .. options.Title .. ".")
            return
        end

        local sliderFrame = create("Frame", {
            Name = options.Title .. "Slider",
            Size = UDim2.new(1, -20, 0, 80),
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Parent = tabContent,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = sliderFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 5),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = sliderFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -20, 0, 15),
            Position = UDim2.new(0, 10, 0, 25),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 12,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = sliderFrame,
        })

        local sliderBar = create("Frame", {
            Name = "SliderBar",
            Size = UDim2.new(1, -40, 0, 5),
            Position = UDim2.new(0, 20, 0, 50),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Parent = sliderFrame,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 2),
            Parent = sliderBar,
        })

        local sliderFill = create("Frame", {
            Name = "SliderFill",
            Size = UDim2.new(0, 0, 1, 0),
            BackgroundColor3 = self.CurrentTheme.Title,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Parent = sliderBar,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 2),
            Parent = sliderFill,
        })

        local sliderHandle = create("ImageLabel", {
            Name = "SliderHandle",
            Size = UDim2.new(0, 15, 0, 15),
            Position = UDim2.new(0, 0, 0.5, 0),
            AnchorPoint = Vector2.new(0.5, 0.5),
            BackgroundTransparency = 1,
            Image = "rbxassetid://2574000300", -- Circle image
            ImageColor3 = self.CurrentTheme.Title,
            Parent = sliderBar,
        })

        local valueLabel = create("TextLabel", {
            Name = "ValueLabel",
            Size = UDim2.new(0, 50, 0, 20),
            Position = UDim2.new(1, -60, 0, 50),
            AnchorPoint = Vector2.new(1, 0),
            BackgroundTransparency = 1,
            Text = tostring(options.Default),
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.Gotham,
            TextSize = 14,
            TextXAlignment = Enum.TextXAlignment.Right,
            Parent = sliderFrame,
        })

        local currentValue = options.Default
        local dragging = false

        local function updateSlider(inputX)
            local relativeX = math.clamp(inputX - sliderBar.AbsolutePosition.X, 0, sliderBar.AbsoluteSize.X)
            local percentage = relativeX / sliderBar.AbsoluteSize.X
            local newValue = math.floor((options.Min + (options.Max - options.Min) * percentage) / options.Step) * options.Step
            currentValue = math.clamp(newValue, options.Min, options.Max)

            local handlePosition = (currentValue - options.Min) / (options.Max - options.Min)
            sliderHandle.Position = UDim2.new(handlePosition, 0, 0.5, 0)
            sliderFill.Size = UDim2.new(handlePosition, 0, 1, 0)
            valueLabel.Text = tostring(currentValue)
            options.Callback(currentValue)
        end

        sliderHandle.InputBegan:Connect(function(input)
            if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
                dragging = true
            end
        end)

        UserInputService.InputEnded:Connect(function(input)
            if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
                dragging = false
            end
        end)

        UserInputService.InputChanged:Connect(function(input)
            if dragging and (input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch) then
                updateSlider(input.Position.X)
            end
        end)

        -- Initial update
        local initialHandlePosition = (options.Default - options.Min) / (options.Max - options.Min)
        sliderHandle.Position = UDim2.new(initialHandlePosition, 0, 0.5, 0)
        sliderFill.Size = UDim2.new(initialHandlePosition, 0, 1, 0)

        table.insert(options.Tab.Elements, sliderFrame)

        return sliderFrame
    end

    -- Method to add a dropdown
    function self:AddDropdown(options: {
        Title: string,
        Description: string,
        Tab: any,
        Items: {string},
        Default: string,
        Callback: (selectedItem: string) -> (),
    })
        local tabContent = options.Tab.Content
        if not tabContent then
            warn("Invalid tab object provided for dropdown " .. options.Title .. ".")
            return
        end

        local dropdownFrame = create("Frame", {
            Name = options.Title .. "Dropdown",
            Size = UDim2.new(1, -20, 0, 70),
            Position = UDim2.new(0.5, 0, 0, 0),
            AnchorPoint = Vector2.new(0.5, 0),
            BackgroundColor3 = self.CurrentTheme.Interactables,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            ClipsDescendants = true,
            Parent = tabContent,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 6),
            Parent = dropdownFrame,
        })

        create("TextLabel", {
            Name = "Title",
            Size = UDim2.new(1, -20, 0, 20),
            Position = UDim2.new(0, 10, 0, 5),
            BackgroundTransparency = 1,
            Text = options.Title,
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.GothamBold,
            TextSize = 15,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = dropdownFrame,
        })

        create("TextLabel", {
            Name = "Description",
            Size = UDim2.new(1, -20, 0, 15),
            Position = UDim2.new(0, 10, 0, 25),
            BackgroundTransparency = 1,
            Text = options.Description,
            TextColor3 = self.CurrentTheme.Description,
            Font = Enum.Font.Gotham,
            TextSize = 12,
            TextWrapped = true,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = dropdownFrame,
        })

        local dropdownButton = create("TextButton", {
            Name = "DropdownButton",
            Size = UDim2.new(1, -20, 0, 25),
            Position = UDim2.new(0, 10, 0, 45),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Text = options.Default or options.Items[1],
            TextColor3 = self.CurrentTheme.Title,
            Font = Enum.Font.Gotham,
            TextSize = 14,
            TextXAlignment = Enum.TextXAlignment.Left,
            Parent = dropdownFrame,
        })

        create("UICorner", {
            CornerRadius = UDim.new(0, 4),
            Parent = dropdownButton,
        })

        local dropdownList = create("Frame", {
            Name = "DropdownList",
            Size = UDim2.new(1, -20, 0, 0), -- Height will be dynamic
            Position = UDim2.new(0, 10, 0, 70),
            BackgroundColor3 = self.CurrentTheme.Component,
            BackgroundTransparency = 0,
            BorderSizePixel = 0,
            Visible = false,
            Parent = dropdownFrame,
        })

        create("UIListLayout", {
            FillDirection = Enum.FillDirection.Vertical,
            HorizontalAlignment = Enum.HorizontalAlignment.Left,
            VerticalAlignment = Enum.VerticalAlignment.Top,
            Padding = UDim.new(0, 2),
            Parent = dropdownList,
        })

        for i, itemText in ipairs(options.Items) do
            local itemButton = create("TextButton", {
                Name = itemText .. "Item",
                Size = UDim2.new(1, 0, 0, 25),
                BackgroundColor3 = self.CurrentTheme.Component,
                BackgroundTransparency = 0,
                BorderSizePixel = 0,
                Text = itemText,
                TextColor3 = self.CurrentTheme.Title,
                Font = Enum.Font.Gotham,
                TextSize = 14,
                TextXAlignment = Enum.TextXAlignment.Left,
                Parent = dropdownList,
            })
            itemButton.MouseButton1Click:Connect(function()
                dropdownButton.Text = itemText
                dropdownList.Visible = false
                options.Callback(itemText)
            end)
        end

        dropdownButton.MouseButton1Click:Connect(function()
            dropdownList.Visible = not dropdownList.Visible
            if dropdownList.Visible then
                dropdownList.Size = UDim2.new(1, -20, 0, #options.Items * 27) -- 25 height + 2 padding
            else
                dropdownList.Size = UDim2.new(1, -20, 0, 0)
            end
        end)

        table.insert(options.Tab.Elements, dropdownFrame)

        return dropdownFrame
    end

    -- Add a generic function to resize tab content based on its children
    local function updateTabContentSize(tabContentFrame)
        local uiListLayout = tabContentFrame:FindFirstChildOfClass("UIListLayout")
        if uiListLayout then
            local totalHeight = 0
            for _, child in pairs(tabContentFrame:GetChildren()) do
                if child:IsA("Frame") or child:IsA("TextButton") then
                    totalHeight += child.AbsoluteSize.Y + uiListLayout.Padding.Offset
                end
            end
            tabContentFrame.CanvasSize = UDim2.new(0, 0, 0, totalHeight)
        end
    end

    -- Connect to children added/removed to update canvas size dynamically
    for _, tab in pairs(self.Tabs) do
        tab.Content.ChildAdded:Connect(function() updateTabContentSize(tab.Content) end)
        tab.Content.ChildRemoved:Connect(function() updateTabContentSize(tab.Content) end)
    end

    -- Initial update for all tab contents
    for _, tab in pairs(self.Tabs) do
        updateTabContentSize(tab.Content)
    end

    return self
end

return RobloxUILibrary


    -- Minimize/Maximize functionality
    local isMinimized = false
    local originalSize = self.MainFrame.Size
    local originalPosition = self.MainFrame.Position

    local function toggleMinimize()
        isMinimized = not isMinimized
        if isMinimized then
            self.MainFrame.Visible = false
        else
            self.MainFrame.Visible = true
        end
    end

    UserInputService.InputBegan:Connect(function(input, gameProcessedEvent)
        if not gameProcessedEvent and input.KeyCode == options.MinimizeKeybind then
            toggleMinimize()
        end
    end)

    self.MinimizeButton.MouseButton1Click:Connect(toggleMinimize)

    -- Method to save settings (placeholder for now)
    function self:SaveSettings()
        -- Implement saving settings to DataStore or similar
        warn("SaveSettings method not yet fully implemented.")
    end

    -- Method to load settings (placeholder for now)
    function self:LoadSettings()
        -- Implement loading settings from DataStore or similar
        warn("LoadSettings method not yet fully implemented.")
    end

    -- Update applyTheme to handle active tab button styling
    local originalApplyTheme = applyTheme
    applyTheme = function(instance: Instance, themeName: string, themeTable: {}) 
        originalApplyTheme(instance, themeName, themeTable)
        if instance.Name:match("Tab$") and instance:IsA("TextButton") then
            local tabTitle = instance:FindFirstChild("Title")
            local tabIcon = instance:FindFirstChild("Icon")
            if tabTitle and tabIcon then
                if self.ActiveTab and self.Tabs[self.ActiveTab] and self.Tabs[self.ActiveTab].Button == instance then
                    instance.BackgroundColor3 = themeTable.Primary
                    tabTitle.TextColor3 = themeTable.Title
                    tabIcon.ImageColor3 = themeTable.Title
                else
                    instance.BackgroundColor3 = themeTable.Interactables
                    tabTitle.TextColor3 = themeTable.Tab
                    tabIcon.ImageColor3 = themeTable.Icon
                end
            end
        end
    end

    -- Re-assign applyTheme in SetTheme method
    local originalSetTheme = self.SetTheme
    function self:SetTheme(themeName: string)
        originalSetTheme(self, themeName)
        -- Re-apply theme to all elements after the main frame properties are set
        applyTheme(self.MainFrame, themeName, self.CurrentTheme)
    end

    -- Ensure the initial theme is applied correctly to all elements
    applyTheme(self.MainFrame, options.Theme, self.CurrentTheme)

    return self
end

return RobloxUILibrary


    --// DataStore Service for saving/loading settings
    local DataStoreService = game:GetService("DataStoreService")
    local Players = game:GetService("Players")
    local SETTINGS_DATASTORE_NAME = "RobloxUILibrarySettings"

    -- Method to save settings
    function self:SaveSettings(settingsTable: {}) 
        local player = Players.LocalPlayer
        if not player then return end

        local success, err = pcall(function()
            local settingsStore = DataStoreService:GetDataStore(SETTINGS_DATASTORE_NAME .. "_" .. player.UserId)
            settingsStore:SetAsync("UISettings", settingsTable)
        end)

        if not success then
            warn("Failed to save UI settings: " .. err)
        else
            print("UI settings saved successfully.")
        end
    end

    -- Method to load settings
    function self:LoadSettings() : {} 
        local player = Players.LocalPlayer
        if not player then return {} end

        local settings = {}
        local success, err = pcall(function()
            local settingsStore = DataStoreService:GetDataStore(SETTINGS_DATASTORE_NAME .. "_" .. player.UserId)
            settings = settingsStore:GetAsync("UISettings") or {}
        end)

        if not success then
            warn("Failed to load UI settings: " .. err)
        else
            print("UI settings loaded successfully.")
        end
        return settings
    end

    -- Example of how to integrate Save/Load with components (e.g., Toggle)
    -- This would typically be done within each component's creation function
    -- For demonstration, let's add a placeholder for a settings tab
    function self:AddSettingsTab(options: {
        Title: string,
        Section: string,
        Icon: string,
    })
        local settingsTab = self:AddTab(options)

        -- Add a button to save settings
        self:AddButton({
            Title = "حفظ الإعدادات",
            Description = "يحفظ الإعدادات الحالية للواجهة.",
            Tab = settingsTab,
            Callback = function()
                -- Collect current settings from all components and pass to SaveSettings
                -- This requires iterating through all active components and their states
                -- For simplicity, we'll save a dummy table for now
                local currentSettings = {
                    Theme = self.Options.Theme,
                    MinimizeKeybind = self.Options.MinimizeKeybind.Name,
                    -- ... other component states
                }
                self:SaveSettings(currentSettings)
                self:Notify({
                    Title = "تم الحفظ",
                    Description = "تم حفظ إعدادات الواجهة بنجاح.",
                    Duration = 3
                })
            end
        })

        -- Add a button to load settings
        self:AddButton({
            Title = "تحميل الإعدادات",
            Description = "يحمل الإعدادات المحفوظة مسبقًا للواجهة.",
            Tab = settingsTab,
            Callback = function()
                local loadedSettings = self:LoadSettings()
                if loadedSettings.Theme then
                    self:SetTheme(loadedSettings.Theme)
                    self:Notify({
                        Title = "تم التحميل",
                        Description = "تم تحميل إعدادات الواجهة بنجاح.",
                        Duration = 3
                    })
                else
                    self:Notify({
                        Title = "خطأ",
                        Description = "لا توجد إعدادات محفوظة للتحميل.",
                        Duration = 3
                    })
                end
            end
        })

        return settingsTab
    end

    -- Initial load of settings when the window is created
    local initialSettings = self:LoadSettings()
    if initialSettings.Theme then
        self:SetTheme(initialSettings.Theme)
    end

    return self
end

return RobloxUILibrary
