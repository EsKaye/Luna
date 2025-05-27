# 🛠️ Development Environment Setup Guide

## Prerequisites

### Required Software
1. **Unreal Engine 5**
   - Download from [Epic Games Launcher](https://www.epicgames.com/store/en-US/download)
   - Install Unreal Engine 5.3 or later
   - Enable C++ development tools during installation

2. **Visual Studio 2022**
   - Download from [Visual Studio Downloads](https://visualstudio.microsoft.com/downloads/)
   - Install with "Game Development with C++" workload
   - Required components:
     - C++ core features
     - Windows 10/11 SDK
     - .NET Framework 4.6.2 development tools

3. **Git**
   - Download from [Git Downloads](https://git-scm.com/downloads)
   - Install with default settings

### Optional but Recommended
1. **Blender**
   - Download from [Blender Downloads](https://www.blender.org/download/)
   - Latest stable version recommended

2. **Adobe Firefly**
   - Access through [Adobe Creative Cloud](https://www.adobe.com/products/firefly.html)
   - For AI-powered asset generation

## Setup Steps

### 1. Install Unreal Engine
1. Open Epic Games Launcher
2. Navigate to "Unreal Engine" tab
3. Click "Install Engine"
4. Select version 5.3 or later
5. Enable "C++ development tools"
6. Complete installation

### 2. Configure Visual Studio
1. Open Visual Studio Installer
2. Modify Visual Studio 2022
3. Select "Game Development with C++"
4. Install selected components

### 3. Project Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/celestial-syndicate.git
   cd celestial-syndicate
   ```

2. Create Unreal Project:
   - Open Epic Games Launcher
   - Click "New Project"
   - Select "Games"
   - Choose "Blank"
   - Set project name to "CelestialSyndicate"
   - Enable C++
   - Choose project location
   - Click "Create Project"

3. Configure Project Settings:
   - Open project in Unreal Editor
   - Edit > Project Settings
   - Enable required plugins:
     - Enhanced Input
     - Physics Control
     - Network Prediction
     - Gameplay Abilities

### 4. Development Environment
1. Set up source control:
   ```bash
   git init
   git add .
   git commit -m "Initial project setup"
   ```

2. Configure IDE:
   - Open project in Visual Studio
   - Set up debugging configuration
   - Configure build settings

## Verification

To verify your setup:

1. Open the project in Unreal Editor
2. Create a new C++ class
3. Build the project
4. Run the project

If everything is set up correctly, you should see the default Unreal Engine level with no errors.

## Troubleshooting

### Common Issues

1. **Build Errors**
   - Ensure Visual Studio has all required components
   - Verify Unreal Engine installation
   - Check project file paths

2. **Missing Dependencies**
   - Run Unreal Engine's dependency checker
   - Verify SDK installations
   - Check system requirements

3. **IDE Integration**
   - Regenerate project files
   - Restart IDE
   - Clear intermediate files

## Next Steps

After completing the setup:

1. Review the project architecture
2. Set up version control
3. Create initial project structure
4. Begin development

---

*This guide will be updated as the project evolves and new requirements are added.* 