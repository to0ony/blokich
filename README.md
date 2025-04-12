![Logo](https://i.imgur.com/GS2tBvQ.png "Logo")

![](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)![](https://img.shields.io/badge/nestjs-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)![](https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue)

Web aplikacija namijenjena vozačima javnog prijevoza u Zagrebu - ZET.

## Značajke

- Ručni unos pdf datoteka sa ZETovih stranica
- Automatiziran proces obrade podataka disponenata i službi uz korištenje python skripte
- Prikaz vozačevog rasporeda vožnje za aktualni i naredni tjedan
- Prikaz vozačeve današnje smjene uz podatke o ostalim vozačima s kojima dijeli smjenu
- Prikaz svih vozača određene linije za određeni dan u tjednu (aktualnom ili narednom)

## U izradi

#### Funkcionalnosti za vozače

- Prikaz svih vozača uz ispis odgovoarajućih službenih brojeva
- Prikaz svih aktualnih službi
- Integracija [openholidaysapi](https://www.openholidaysapi.org/en/sources/#croatia "API") za prikaz neradnih dana unutar rasporeda vožnji

#### Funkcionalnosti za administratora

- Potpuna implementacija admin dashboarda (UI)
- Ručni unos promjena u disponent (iznenadna bolovanja, godišnji...)

## Screenshots

<div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
  <img src="https://i.imgur.com/tLdjM2s.png" alt="screenshot 1" width="200" />
  <img src="https://i.imgur.com/EqDBLKx.png" alt="screenshot 2" width="200" />
  <img src="https://i.imgur.com/JF1le4n.png" alt="screenshot 3" width="200" />
</div>

Ovaj projekt je licenciran pod [MIT licencom](LICENSE).
