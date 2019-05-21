$ErrorActionPreference = "Stop"

$ARCHITECTURE = "$($args[0])"
$OS = "$($args[1])"
$HUB_ORG = "$($args[2])"
$IMAGE_NAME = "$($args[3])"

# TODO: remove hardcoded values after automating the build process with the JFrog CI/CD
$ARCHITECTURE = "x86_64"
$OS = "WindowsServer_2019"
$HUB_ORG = "drydock"
$IMAGE_NAME = "kermit-w19reqproc"

$TAG = "master"
$HUB_IMAGE = "${HUB_ORG}/${IMAGE_NAME}:${TAG}"

# Paths used for downloading zip files
$DOWNLOADS_DIR = "$PSScriptRoot/downloads"
$EXEC_TEMPLATES_ZIP_PATH = "$DOWNLOADS_DIR/execTemplates.zip"
$REQEXEC_ZIP_PATH = "$DOWNLOADS_DIR/reqExec.zip"

# Paths used for extracting the zip files
$EXTRACTS_DIR = "$PSScriptRoot/extracts"
$EXEC_TEMPLATES_EXTRACT_PATH = "$EXTRACTS_DIR/execTemplates"
$REQEXEC_EXTRACT_PATH = "$EXTRACTS_DIR/reqExec"

# Paths used by building reqProc image
$EXEC_TEMPLATES_PATH = "C:/Users/ContainerAdministrator/Shippable/execTemplates"
$REQEXEC_PATH = "./reqExec"

Function check_input() {
  if (-not $ARCHITECTURE) {
    Throw "Missing input parameter ARCHITECTURE"
  }

  if (-not $OS) {
    Throw "Missing input parameter OS"
  }

  if (-not $HUB_ORG) {
    Throw "Missing input parameter HUB_ORG"
  }

  if (-not $IMAGE_NAME) {
    Throw "Missing input parameter HUB_ORG"
  }
}

Function init_directories() {
  if (Test-Path -Path $DOWNLOADS_DIR) {
    Remove-Item -Recurse -Force $DOWNLOADS_DIR
  }
  New-Item -Path $DOWNLOADS_DIR -ItemType Directory

  if (Test-Path -Path $EXTRACTS_DIR) {
    Remove-Item -Recurse -Force $EXTRACTS_DIR
  }
  New-Item -Path $EXTRACTS_DIR -ItemType Directory

  if (Test-Path -Path $EXEC_TEMPLATES_PATH) {
    Remove-Item -Recurse -Force $EXEC_TEMPLATES_PATH
  }
  New-Item -Path $EXEC_TEMPLATES_PATH -ItemType Directory

  if (Test-Path -Path $REQEXEC_PATH) {
    Remove-Item -Recurse -Force $REQEXEC_PATH
  }
  New-Item -Path $REQEXEC_PATH\dist\main -ItemType Directory
}

Function download_execTemplates() {
  $EXEC_TEMPLATES_URL = "https://codeload.github.com/Shippable/kermit-execTemplates/zip/master"
  Invoke-WebRequest $EXEC_TEMPLATES_URL -OutFile $EXEC_TEMPLATES_ZIP_PATH
  Expand-Archive  $EXEC_TEMPLATES_ZIP_PATH -DestinationPath $EXEC_TEMPLATES_EXTRACT_PATH -Force
  Move-Item -Force $EXEC_TEMPLATES_EXTRACT_PATH\kermit-execTemplates-master\* -Destination $EXEC_TEMPLATES_PATH;
}

Function download_reqExec() {
  $REQEXEC_URL = "https://codeload.github.com/Shippable/kermit-reqExec/zip/master"
  Invoke-WebRequest $REQEXEC_URL -OutFile $REQEXEC_ZIP_PATH
  Expand-Archive  $REQEXEC_ZIP_PATH -DestinationPath $REQEXEC_EXTRACT_PATH -Force
}

Function build_reqExec() {
  Push-Location $REQEXEC_EXTRACT_PATH\kermit-reqExec-master
    & .\package\$ARCHITECTURE\$OS\package.ps1
  Pop-Location
  Move-Item -Force $REQEXEC_EXTRACT_PATH\kermit-reqExec-master\dist\main.exe -Destination $REQEXEC_PATH\dist\main\main.exe;
}

Function set_build_context() {
  (Get-Content ./image/$ARCHITECTURE/$OS/Dockerfile) -replace '{{%TAG%}}', "$TAG" | Set-Content ./image/$ARCHITECTURE/$OS/Dockerfile
}

Function build_and_tag_image() {
  docker build --no-cache -f ./image/$ARCHITECTURE/$OS/Dockerfile -t "$HUB_IMAGE" .
}

Function push_images() {
  docker push "$HUB_IMAGE"
}

Function cleanup_directories() {
  Remove-Item -Recurse -Force $DOWNLOADS_DIR
  Remove-Item -Recurse -Force $EXTRACTS_DIR
  Remove-Item -Recurse -Force $EXEC_TEMPLATES_PATH
  Remove-Item -Recurse -Force $REQEXEC_PATH
}

# TODO: Remove all the execTemplate and reqExec functions after using the gitRepo resource
# while automating the build process with the JFrog CI/CD
check_input
init_directories
download_execTemplates
download_reqExec
build_reqExec
set_build_context
build_and_tag_image
push_images
cleanup_directories
