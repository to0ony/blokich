# OSRM – skretanja s imenima ulica za navigaciju

Navigacija u Blokichu (`GET /api/karta/navigacija`) radi i bez ovoga: skretanja
se tada računaju iz oblika trase („za 200 m desno“), bez imena ulica.

S OSRM-om skretanja dobiju imena ulica i kružne tokove („desno u Ilicu“,
„na kružnom toku 3. izlaz“). Za svaku trasu backend jednom traži rutu kroz
stajališta linije redom i provjerava da ide istim putem kao ZET-ova trasa.
Ako ne ide (npr. bus vozi ulicom zatvorenom za aute), ta trasa ostaje na
skretanjima iz oblika.

## Postavljanje na serveru (Docker)

Treba ~3 GB RAM-a za pripremu (jednom) i ~500 MB dok radi.

```bash
cd ~/blokich/service/blokich/osrm
./pripremi.sh          # skine kartu Hrvatske i pripremi je (par minuta)
docker compose up -d   # OSRM na 127.0.0.1:5000
```

U `service/blokich/.env` dodaj:

```
OSRM_URL=http://127.0.0.1:5000
OSRM_MAX_TOCAKA=100
```

i restartaj backend (`pm2 restart blokich --update-env`).

Provjera:

```bash
curl "http://127.0.0.1:5000/route/v1/driving/15.94,45.81;15.96,45.81?steps=true" | head -c 300
```

## Osvježavanje karte

Ulice se rijetko mijenjaju; po želji jednom mjesečno:

```bash
./pripremi.sh && docker compose restart
```

`data/` je u `.gitignore`.
