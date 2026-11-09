# AGENTS.md — Reguli generale pentru Codex

Aceste instrucțiuni se aplică întregului repository. Un fișier AGENTS.md dintr-un subdirector poate adăuga reguli specifice zonei respective. Respectă întotdeauna instrucțiunile directe ale utilizatorului și cerințele de siguranță.

## Comunicare și colaborare

- Vorbește implicit în română, natural, concis și precis. Fără laude gratuite sau discurs formal inutil.
- Înțelege întâi scopul real al utilizatorului. Nu confunda brainstorming-ul cu o implementare aprobată.
- Pentru lucrări mari, prezintă un plan scurt, apoi realizează modificările în pași coerenți. Evită să schimbi mai multe subsisteme fără legătură într-un singur pas.
- Propune îmbunătățiri când ai argumente, dar nu substitui cerința utilizatorului cu o idee proprie.
- Nu cere repetarea contextului deja disponibil. Nu pretinde că un pas este gata fără verificarea efectivă.
- La final, explică exact ce ai modificat, unde, ce ai testat și ce rămâne neverificat.

## Standard UI/UX implicit — Seamless Modern UI / Premium Minimalist

Se aplică oricărei interfețe noi: website, aplicație, dashboard, PWA sau pagină de configurare.

- Începe de la un flux orientat spre sarcină: **ce aleg → ce configurez → ce se întâmplă / ce rezultat văd**.
- Preferă elemente integrate natural în fundal, cu ierarhie realizată prin tipografie, aliniere, spațiere controlată și separatoare discrete.
- Evită „card peste card”, chenare evidente, fundaluri fragmentate fără motiv, spații risipite și tabele tehnice expuse inutil.
- **Cardurile sunt opționale, nu structura implicită.** Folosește-le doar dacă gruparea este utilă.
- Preferă segmented controls, selecții contextuale și controale moderne în locul dropdown-urilor native folosite mecanic. Păstrează accesibilitatea tastaturii și etichete clare.
- Aplică **progressive disclosure**: arată numai opțiunile relevante pentru modul selectat; lasă diagnosticul și setările rare în zone extensibile.
- Proiectează **mobile-first**, apoi verifică desktop. Prioritizează spațiul util, zone de atingere suficiente, contrastul, focusul și stările de eroare.
- Animațiile, dacă există, să fie discrete și compatibile cu preferința reduced motion.
- Nu te limita la schimbări cosmetice când cerința este „remodelează”. Regândește arhitectura informației și interacțiunile.
- Referința vizuală pentru proiectele Hidrofor este secțiunea **„Evoluția timpului”** din Centrala Hidrofor: prezentare aerisită, seamless, fără containere redundante.
- Nu copia automat culorile Hidrofor în proiecte fără legătură; transferă principiile UX, nu identitatea vizuală.

## Mod de lucru în cod

1. Inspectează sursele, documentația, branch-ul și testele înainte de modificări.
2. Reutilizează funcționalitatea validată. Evită rescrierile mari, dublarea logicii și „îmbunătățirile” care schimbă semantic cerința.
3. Păstrează API-urile, datele utilizatorului și compatibilitatea acolo unde sunt relevante; dacă este necesară migrarea, implementeaz-o explicit.
4. Nu adăuga biblioteci sau straturi arhitecturale fără beneficii concrete.
5. Verifică prin teste logice și, pentru UI, prin browser la dimensiuni mobile și desktop; testează și cazurile negative. Nu echivala verificarea sintaxei cu testarea vizuală.
6. Nu inventa rezultate de compilare, teste, URL-uri, capturi sau disponibilitate în producție. Distinge între verificat, neverificat și blocat de mediu.
7. Lucrează pe ramura de dezvoltare potrivită. Nu modifica sau publica automat în `main` modificări funcționale fără solicitare / aprobare explicită.
8. Nu adăuga secrete, parole, tokenuri, date private sau configurații locale sensibile în repository.

## Siguranță

- Comportamentul simulat nu este dovadă că un sistem fizic este sigur.
- Nu transforma implicit un control demonstrativ într-o comandă reală.
- Nu face operații distructive sau activări hardware fără instrucțiuni explicite și verificări corespunzătoare.
