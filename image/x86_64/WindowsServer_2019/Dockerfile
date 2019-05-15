FROM mcr.microsoft.com/windows/servercore:ltsc2019

SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

ENV IMAGE_REQPROC_DIR C:/Users/ContainerAdministrator/Shippable/reqProc
RUN mkdir $Env:IMAGE_REQPROC_DIR
WORKDIR  C:/Users/ContainerAdministrator/Shippable/reqProc
ADD . .
RUN .\image\x86_64\WindowsServer_2019\install_util.ps1
RUN .\image\x86_64\WindowsServer_2019\install_node.ps1
RUN npm install

ENV GIT_SSH "C:\Program Files\OpenSSH-Win64\ssh.exe"
ENV OPENSSH_FIX_USER_FILEPERMS "C:\Program Files\OpenSSH-Win64\FixUserFilePermissions.ps1"

# execTemplates
ENV IMAGE_EXEC_TEMPLATES_DIR C:/Users/ContainerAdministrator/Shippable/execTemplates
RUN mkdir $Env:IMAGE_EXEC_TEMPLATES_DIR; \
    Move-Item -Force $env:IMAGE_REQPROC_DIR\execTemplates\* -Destination $env:IMAGE_EXEC_TEMPLATES_DIR; \
    Remove-Item -Recurse -Force $env:IMAGE_REQPROC_DIR\execTemplates;

# reqExec
ENV IMAGE_REQEXEC_DIR C:/Users/ContainerAdministrator/Shippable/reqExec
RUN mkdir -p $env:IMAGE_REQEXEC_DIR\x86_64\WindowsServer_2019\; \
    Move-Item -Force $env:IMAGE_REQPROC_DIR\reqExec\* -Destination $env:IMAGE_REQEXEC_DIR\x86_64\WindowsServer_2019\; \
    Remove-Item -Recurse -Force $env:IMAGE_REQPROC_DIR\reqExec;

# Docker client binary
RUN Invoke-WebRequest https://download.docker.com/components/engine/windows-server/18.09/docker-18.09.6.zip -OutFile docker-18.09.6.zip; \
    mkdir c:\docker; \
    Expand-Archive  .\docker-18.09.6.zip -DestinationPath $env:TEMP/docker/ -Force; \
    Move-Item $env:TEMP\docker\docker\docker.exe c:\docker\docker.exe; \
    $env:PATH = '{0};c:\docker' -f $env:PATH ; \
    [Environment]::SetEnvironmentVariable('PATH', $env:PATH, [EnvironmentVariableTarget]::Machine); \
    Remove-Item .\docker-18.09.6.zip; \
    Remove-Item -recur -force $env:TEMP\docker;

# Install git
RUN choco install -y git

WORKDIR C:/Users/ContainerAdministrator/Shippable/reqProc
CMD C:\Users\ContainerAdministrator\Shippable\reqProc\boot.ps1
