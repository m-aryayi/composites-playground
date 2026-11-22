# Composites Playground

Interactive lessons on the mechanics of fiber composites.
Stack plies, move sliders, and see the physics.

Live site: https://m-aryayi.github.io/composites-playground/

## Lessons

| Lesson | Topic | Status |
|---|---|---|
| [Is it symmetric?](https://m-aryayi.github.io/composites-playground/tools/laminate-symmetry/) | Laminates, classical lamination theory | Live |
| [Two materials, one stiffness](https://m-aryayi.github.io/composites-playground/tools/rve-homogenization/) | Micromechanics, RVE homogenization | Live |

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000/

## Python

Each lesson has a desktop app and a Jupyter notebook in `python/`.

```
pip install -r python/requirements.txt
python python/laminate_symmetry.py
python python/rve_homogenization.py
```

## Tests

The JavaScript physics is checked against the textbook examples and the
reference values of the Python apps in `python/`.
Start the local server as above, then open http://localhost:8000/tests/

## License

Code: MIT (see [LICENSE](LICENSE)).
Libraries in [vendor/](vendor/): three.js and KaTeX, both MIT (versions in [vendor/VERSIONS.txt](vendor/VERSIONS.txt)).
Lesson text and figures: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
