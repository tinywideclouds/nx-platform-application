# **Internal Workspace Tools (internal-tools)**

This library is a private Nx plugin for this workspace. Its purpose is to hold custom code generators and executors to automate common tasks, enforce conventions, and speed up development. As the workspace grows, you can add new generators to this plugin to streamline other repetitive processes.

## **Available Generators**

This plugin provides the following generators:

### **application**

Scaffolds a new, minimal Angular frontend application. The generated app is pre-configured with the standard authentication flow, proxy setup, and all the necessary libraries to connect to the identity-service.

#### **Usage**

Bash
````
nx g @nx-platform-application/internal-tools:application \<app-name\> \--path=\<optional-subdirectory\>

````

*(Replace \<app-name\> and \<optional-subdirectory\> with your desired values)*

#### **Options**

| Option | Description | Required | Default |
|:-------| :---- | :---- | :---- |
| name   | The name of the new application. | Yes | (Positional) |
| path   | An optional sub-directory within apps/ to create the app in. | No | (None) |

## **Developing This Plugin**

These commands are for developers who need to modify or extend the tools in this library.

### **Building**

After making any changes to the generator's code, you must rebuild the plugin for the changes to take effect.

````cmd
nx build internal-tools
````


### **Running Unit Tests**

To execute the unit tests for the plugin's generators, run:

Bash

nx test internal-tools  
