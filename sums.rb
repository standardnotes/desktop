require 'json'

package = JSON.parse(File.read("package.json"))
version = package["version"]

files = [
  "Standard Notes-#{version}-mac.zip",

  "Standard Notes-#{version}.dmg",
  "Standard Notes-#{version}.dmg.blockmap",

  "Standard Notes-#{version}-i386.AppImage",
  "Standard Notes-#{version}.AppImage",

  "Standard Notes Setup #{version}.exe",
  "Standard Notes Setup #{version}.exe.blockmap",

  "standard-notes_#{version}_amd64.snap",

  "latest-linux-ia32.yml",
  "latest-linux.yml",
  "latest-mac.yml",
  "latest.yml"
]

output = ""

files.each do |file|
  sum = `cd dist && sha256sum '#{file}'`
  output += "#{sum}"
end

File.write('dist/SHA256SUMS', output)

puts "Successfully wrote SHA256SUMS:\n#{output}"
