# Playing Ragnagrok at home on Windows

You need one Windows computer (the server), a TV or screen, and everyone's phones on the same home network.

## One-time setup (5 minutes)

1. Install **Node.js**: go to https://nodejs.org, download the **LTS** version, run the installer, click Next through every screen.
2. Unzip the Ragnagrok folder somewhere easy, such as your Desktop.

## Every game night

1. Double-click **Start Ragnagrok.bat** in the folder. The first time, it spends a minute installing.
2. A black window opens and stays open. **Keep it open while you play.** Your browser opens the TV screen.
3. Show the browser on your TV: drag it to the TV screen, use an HDMI cable, or cast the tab. Press **F11** for full screen.
4. Everyone scans the QR code on the TV with their phone camera.
5. To stop, close the black window.

## If the first time Windows asks about the firewall

A box says *"Windows Defender Firewall has blocked some features of Node.js"*. Tick **Private networks** and click **Allow access**. This is what lets phones reach the game. Don't tick Public.

## If phones can't join

| Problem | Fix |
|---|---|
| Phone says "can't reach" or spins forever | The phone must be on your **home Wi-Fi**, not mobile data. Turn Wi-Fi on. |
| Still can't reach | Windows firewall: Start → type **Allow an app through Windows Firewall** → Change settings → find **Node.js** → tick **Private** → OK. |
| Your Wi-Fi is set to "Public" | Settings → Network & internet → Wi-Fi (or Ethernet) → your network → set **Network profile type** to **Private**. |
| Guest Wi-Fi or "AP isolation" / "client isolation" | Guest networks stop devices talking to each other. Use your main Wi-Fi, or switch isolation off in your router settings. |
| Computer on Ethernet, phones on Wi-Fi | Works normally if both are on the same router. If you have a separate mesh or extender in "bridge" mode it also works; a second router doing its own network will not. |
| The QR code shows a strange address (172.x or 10.x) | Your computer has a virtual network (VPN, WSL, Docker). Disconnect the VPN, or type the right address by hand: the black window prints **Phones: … /play** with the address to use. |

## Finding your computer's address by hand

The black window prints it when the game starts: `Phones: … go to http://192.168.1.20:3000/play`.
Type that address into the phone's browser and enter the room code from the TV.

## The original game

Double-click **Start Ragnagrok (original v0.5).bat** to play the first, Catan-style version.

## Changing the port

If something else already uses port 3000, open a Command Prompt in the folder and run:
`set PORT=3100 && npm start`
