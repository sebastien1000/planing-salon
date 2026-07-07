# Maintenance

## Demarrage local

Lancer un serveur local :

```bash
python3 -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000
```

## Verifications manuelles conseillees

Avant de considerer une modification comme valide :

1. tester la connexion
2. ouvrir `planning.html`
3. ouvrir `clients.html`
4. ouvrir `recherche.html`
5. ouvrir `comptes.html`
6. ouvrir `plus.html`
7. verifier qu'un ajout de RDV fonctionne
8. verifier qu'une fiche cliente peut etre ouverte

## Service worker

Le projet utilise `sw.js`.
Apres un changement important sur les scripts ou les styles :

1. incrementer `CACHE_NAME`
2. recharger la page completement
3. verifier que les anciens fichiers ne sont plus servis depuis le cache

## Stockage local

Les donnees sont enregistrees dans `localStorage` avec la cle :

```text
salonMvpV4
```

Attention :

- `localStorage` a une taille limitee
- les images en base64 prennent vite beaucoup de place
- si le stockage sature, les photos doivent rester consideres comme jetables

## Recommandations de code

- garder la logique partagee dans `js/core/`
- garder la logique d'ecran dans `js/pages/`
- eviter les fonctions trop longues
- limiter les chaines HTML construites a la main quand elles deviennent trop grosses
- ajouter une verification manuelle apres chaque modification de `sw.js`, `data.js` ou `ui.js`
