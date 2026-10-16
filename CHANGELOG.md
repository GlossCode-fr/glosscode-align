# Change Log — GlossCod€ Align

Toutes les modifications notables de l'extension sont documentées dans ce fichier.
All notable changes to this extension are documented in this file.

Format : [Keep a Changelog](http://keepachangelog.com/).

---

## [0.0.2] — 2026-10-16

### 🇫🇷 Français

#### Corrigé
- L'alignement ne casse plus en présence de commentaires, de lignes vides, ou de variables CSS dans un sélecteur
- Un bloc est désormais défini par ses accolades `{ }` et non plus par des propriétés consécutives
- YAML : plus d'espace parasite sur une clé parente sans valeur
- YAML : une clé de même niveau placée après un sous-bloc rejoint à nouveau le bloc parent
- Prise en charge correcte des fichiers en fin de ligne CRLF (Windows)

#### Modifié
- Chaque sélecteur imbriqué (SCSS / LESS) a son propre alignement indépendant

### 🇬🇧 English

#### Fixed
- Alignment no longer breaks when comments, blank lines, or CSS variables appear inside a selector
- A block is now defined by its braces `{ }` instead of consecutive properties
- YAML: no more stray trailing space on a parent key without value
- YAML: a same-level key placed after a sub-block now rejoins the parent block
- Correct handling of files with CRLF line endings (Windows)

#### Changed
- Each nested selector (SCSS / LESS) now has its own independent alignment

---

## [0.0.1] — 2026-04-30

### 🇫🇷 Français

#### Ajouté
- Alignement du fichier entier avec `Alt+G`
- Alignement du bloc au curseur avec `Alt+C`
- Support des langages : CSS, SCSS, SASS, LESS
- Support des langages : JSON, JSONC
- Support du langage : YAML
- Détection automatique du séparateur selon le type de fichier
- Respect des niveaux d'indentation
- Comportement idempotent (ré-application sans effet de bord)

### 🇬🇧 English

#### Added
- Whole-file alignment with `Alt+G`
- Block-at-cursor alignment with `Alt+C`
- Language support: CSS, SCSS, SASS, LESS
- Language support: JSON, JSONC
- Language support: YAML
- Automatic separator detection based on file type
- Respect of indentation levels
- Idempotent behavior (re-applying does not change the result)
