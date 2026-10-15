# Feuerwehr-Lernplattform – Einrichtung mit Docker

Eine passwortgeschützte Webseite mit den Lerninhalten aus der Ausbildung: Lernseiten, Prüfungsfragen zum Aufklappen und eine Übungsprüfung (Multiple Choice). Läuft in einem einzigen Docker-Container.

## Inhalt dieses Ordners

| Datei / Ordner | Wozu |
|---|---|
| `docker-compose.yml` | Startet die Lernplattform (und optional den Cloudflare-Tunnel) |
| `Dockerfile` | Baut den Container |
| `.env.example` | Vorlage für Passwort und Einstellungen |
| `content/` | **Die Lerninhalte** – hier kommen neue Themen hinein (siehe `INHALTE.md`) |
| `public/` | Die Webseite selbst |
| `server.js`, `lib/` | Der Server (Anmeldung, Inhalte ausliefern) |

## 1. Repository auf den Docker-Rechner holen

```sh
cd /opt
git clone https://github.com/Trommse/feuerwehr-lernplattform.git
cd feuerwehr-lernplattform
```

(Das Repo ist privat. Beim ersten `git clone` fragt GitHub nach Benutzername und einem Personal Access Token – genau wie beim Baumverkauf.)

## 2. Passwort festlegen

```sh
cp .env.example .env
openssl rand -hex 32
```

Dann `.env` öffnen (z. B. `nano .env`):

- `APP_PASSWORD=` → das Passwort für die Lernplattform
- `SESSION_SECRET=` → die lange Zeichenkette von `openssl rand -hex 32` einfügen

Das Passwort steht **nur** in der `.env` auf deinem Server, nicht im GitHub-Repo.

## 3. Starten

```sh
docker compose up -d --build
```

Danach im Browser öffnen: `http://<IP-des-Rechners>:8091`

Nach dem Anmelden bleibt man 30 Tage eingeloggt. Wird das Passwort in der `.env` geändert, müssen sich alle neu anmelden.

## 4. Aus dem Internet erreichbar machen (Cloudflare Tunnel)

Wie beim Baumverkauf – keine Portfreigabe nötig, HTTPS gibt es automatisch.

1. Bei Cloudflare: **Zero Trust → Networks → Tunnels → Create a tunnel**, Typ **Cloudflared**, Name z. B. `lernplattform`.
2. Den **Token** in `.env` bei `TUNNEL_TOKEN=` eintragen.
3. Einen **Public Hostname** anlegen, z. B. `lernen.deinedomain.de`. Service: **HTTP**, URL: `lernplattform:8080`.
4. In der `.env` `COOKIE_SECURE=true` setzen.
5. Starten:
   ```sh
   docker compose --profile tunnel up -d
   ```

> Du hast schon einen Cloudflare-Tunnel für den Baumverkauf? Dann kannst du dort auch einfach einen zweiten Public Hostname anlegen. Der Tunnel-Container muss dafür aber im selben Docker-Netzwerk sein – einfacher ist ein eigener Tunnel wie oben beschrieben.

Auf dem Handy die Seite öffnen und über „Zum Startbildschirm hinzufügen“ wie eine App ablegen.

## Aktualisieren / neue Themen

Neue Inhalte oder eine neue Version kommen per GitHub:

```sh
cd /opt/feuerwehr-lernplattform && git pull && docker compose up -d --build
```

Deine `.env` bleibt dabei unberührt.

Nur Inhalte geändert (Ordner `content/`)? Dann reicht `git pull` – die Seite liest die Inhalte direkt aus dem Ordner, ein Neustart ist nicht nötig.

Wie man selbst ein neues Thema anlegt, steht in **`INHALTE.md`**.

## Nützliche Befehle

```sh
docker compose logs -f lernplattform          # Protokoll ansehen
docker compose restart lernplattform          # neu starten
docker compose exec lernplattform npm run check   # Inhalte prüfen (zählt Seiten und Fragen, findet Fehler)
docker compose down                           # stoppen
```
