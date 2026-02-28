# Swim Stopwatch - Ansible Provisioning

Ansible playbook for provisioning a Raspberry Pi running **Raspberry Pi OS Lite (Bookworm, 64-bit)** as a Swim Stopwatch appliance.

## Prerequisites

- **Ansible** installed on your control machine (`pip install ansible` or via your package manager)
- **SSH access** to the Raspberry Pi with user `swimwatch`
- The Pi is connected to the network via DHCP

## Configuration

Edit `inventory.ini` and replace `192.168.8.x` with the actual IP address of your Raspberry Pi:

```ini
[swimwatch]
192.168.8.100 ansible_user=swimwatch
```

## Usage

Run the playbook from the `ansible/` directory:

```bash
ansible-playbook playbook.yml
```

To run with a password prompt for SSH and sudo:

```bash
ansible-playbook playbook.yml --ask-pass --ask-become-pass
```

## What Gets Installed

| Component | Description |
|-----------|-------------|
| **Docker** | Docker CE with Compose plugin for arm64 |
| **Chrony** | NTP server for time synchronisation on the local network |
| **Portainer** | Container management web UI |
| **ws-swim-stopwatch** | The Swim Stopwatch application |

## Accessing Services

| Service | URL |
|---------|-----|
| **Swim Stopwatch** | `http://<pi-ip>:80` |
| **Portainer** | `https://<pi-ip>:9443` |

## Chrony NTP Server

The Pi is configured as an NTP server for the `192.168.8.0/24` network. Devices on this subnet (e.g., timing hardware) can synchronise their clocks against the Pi for accurate timestamping.

## Directory Structure on the Pi

```
/opt/swimwatch/
├── docker-compose.yml
├── competition.json
├── uploads/
├── logs/
└── config/
```
