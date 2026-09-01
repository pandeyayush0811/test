$port = 5173
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
$endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Loopback, $port)
$tcpListener = New-Object System.Net.Sockets.TcpListener $endpoint
$tcpListener.Start()

Write-Host "Server running at http://localhost:$port/"

try {
    while ($true) {
        $client = $tcpListener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $requestLine = $reader.ReadLine()

        if ($requestLine) {
            $parts = $requestLine.Split(' ')
            $path = $parts[1].TrimStart('/')
            if ([string]::IsNullOrEmpty($path) -or $path -eq "/") { $path = "index.html" }
            if ($path.Contains("?")) { $path = $path.Substring(0, $path.IndexOf("?")) }

            $filePath = Join-Path $folder $path

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".svg"  { "image/svg+xml" }
                    Default { "application/octet-stream" }
                }

                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($bytes, 0, $bytes.Length)
            } else {
                $body = "404 Not Found: $path"
                $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($bodyBytes, 0, $bodyBytes.Length)
            }
        }
        $stream.Flush()
        $client.Close()
    }
} finally {
    $tcpListener.Stop()
}
