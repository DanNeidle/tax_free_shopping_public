# Tax-free shopping model

A reconstruction of the calculation in Cebr's September 2026 report for the Heart of London Business Alliance, which concluded that bringing back VAT-free shopping for overseas visitors would add £11.5bn to the economy, support 153,000 jobs and hand the Exchequer a net £2.6bn.

The model opens on Cebr's own approach and reproduces its headline GVA and Exchequer figures. You can then test our alternatives and change any assumption you disagree with. Using our illustrative £1.44 GVA benchmark, together with the other three corrections, turns the £2.6bn gain into a £600m loss. That loss depends on the benchmark. Deloitte's underlying totals include government spending and investment, so they don't establish the marginal GVA from extra visitor spending. We apply one overall additionality percentage; those totals don't identify three separate visitor-generated rounds.

The write-up is at [taxpolicy.org.uk](https://taxpolicy.org.uk/vat-free-shopping-cebr/), which sets out the full methodology.

## Two implementations

We wrote the model in Python first, then reimplemented it in JavaScript for the web version.

[`model.py`](model.py) is about forty lines of straight-simple arithmetic. If you want to follow or check the calculation, start here: it's much the easier of the two to read. 

```sh
python3 model.py
```


## The web app

We've included it for openness, but it adds nothing to the Python version of the ability to run a web app It does no arithmetic of its own and calls `model.js` for everything.


[`web/model.js`](web/model.js) is the engine behind the web app. We are much less good at JavaScript, so this was written with extensive AI help, but we verified its output against the Python version and are confident it is functionally equivalent. 

To test this:

```sh
npm test
```

You need Python 3, and Node 20 or later for the JavaScript. There's nothing to install.

To run the model on a mini server:

```sh
npm start
```

Then open http://127.0.0.1:8787. It has a reconciliation panel listing each of Cebr's published figures against ours, with any remaining difference.

The app is set in Poppins. Without it the page falls back to your system sans and everything should still work. To make it look like ours, download Poppins from [Google Fonts](https://fonts.google.com/specimen/Poppins), which publishes it under the SIL Open Font License, and save the regular and semi-bold weights as `web/poppins-400.woff2` and `web/poppins-600.woff2`.

## Inputs

You can obtain the input figures from here:

- [Cebr, tax-free shopping report for the Heart of London Business Alliance, 2026](https://holba.london/content/images/Cebr-report-for-Heart-of-London-Business-Alliance.pdf)
- [VisitBritain, the economic contribution of the tourism economy in the UK, 2013](https://www.visitbritain.org/sites/ind/files/2023-08/The%20economic%20contribution%20of%20the%20tourism%20economy%20in%20the%20UK.pdf)
- [OBR, VAT Retail Export Scheme costing review, 2024](https://obr.uk/docs/dlm_uploads/VAT_RES_costing_review_.pdf)
- [VisitBritain, Foresight 112 on visitor shopping, 2013](https://www.visitbritain.org/media/2356/download?attachment)

Each control in `model.js` carries `source` and `page` fields saying which document and which page it came from.

you can check against Cebr's results with [`web/comparison.js`](web/comparison.js)

## Licence

MIT. See [LICENSE](LICENSE).
