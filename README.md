# Composites Playground

Interactive lessons on the mechanics of fiber composites.
Stack plies, move sliders, and see the physics.

Live site: https://m-aryayi.github.io/composites-playground/

## Lessons

| Lesson | Topic | Status |
|---|---|---|
| Is it symmetric? | Laminates, classical lamination theory | In progress |
| Two materials, one stiffness | Micromechanics, RVE homogenization | Planned |

## Run locally

```
python -m http.server 8000
```

Then open http://localhost:8000/

## Tests

The JavaScript physics is checked against the textbook examples and the
reference values of the Python apps in `python/`.
Start the local server as above, then open http://localhost:8000/tests/

## License

Code: MIT (see [LICENSE](LICENSE)).
Lesson text and figures: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Author

Mohammad Aryayi
