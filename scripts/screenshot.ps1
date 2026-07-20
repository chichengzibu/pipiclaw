param(
    [Parameter(Mandatory=$true)]
    [string]$OutPath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
try {
    $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "saved: $OutPath ($($screen.Width)x$($screen.Height))"
}
finally {
    $g.Dispose()
    $bmp.Dispose()
}
