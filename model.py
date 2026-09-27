# (c) Tax Policy Associates Limited 2026. MIT licence: see LICENSE.

from decimal import Decimal as D
from pathlib import Path
import json
import random
import subprocess
import unittest

# make sure file works from the repo root or from tests/.
MODEL=next(b/'web/model.js' for b in Path(__file__).resolve().parents if (b/'web/model.js').is_file())

def reference(s):
    n=lambda key:D(str(s[key]))
    share=lambda key:n(key)/100
    choose=lambda switch,key,fallback:share(key) if s[switch] else D(fallback)
    gross=n('spending')*share('shoppingShare')*share('eligibility')
    vat=n('vat')/(100+n('vat'))
    # Free lunch pays a flat voucher per arrival instead of refunding VAT. No
    # intermediary takes a cut, so no fee is deducted
    free=bool(s['freeMoney'])
    voucher_cost=n('voucher')*n('visits')/1000
    baseline_refund=D(0) if free else gross*vat*share('takeup')
    baseline_cost=voucher_cost if free else baseline_refund
    consumer=(voucher_cost if free else baseline_refund*(1-share('fee')))*share('passThrough')
    anticipated=consumer*share('salience')
    price=anticipated/n('spending') if n('spending') else D(0)
    realised=D(1)  # the whole response is applied; see the methodology
    arrivals=-n('arrivalsElasticity')*price*realised
    spending=-n('spendingElasticity')*price*realised
    if not s['twoElasticities']:
        new_sales=n('spending')*spending
    else:
        # Independently calculate new total sales, then remove baseline sales.
        new_sales=n('spending')*(1+arrivals)*(1+spending)-n('spending')
    # One overall additionality judgment. The historical benchmark below is
    # illustrative and does not identify separate visitor-generated rounds.
    additional=D(1) if s['ignoreSubstitution'] else share('additionality')
    value_added=new_sales*(D(1) if s['multiplierOnSpending'] else D(58)/D('113.1'))*n('multiplier')*additional
    tax=value_added*share('taxRate')
    # A voucher is paid per arrival, so costing induced ones needs an arrivals
    # count. With one aggregate elasticity there is none, and nothing is charged.
    if free:
        induced=n('visits')*arrivals*n('voucher')/1000 if s['twoElasticities'] else D(0)
    else:
        induced=new_sales*share('shoppingShare')*share('eligibility')*vat*share('takeup')
    refund=baseline_cost+(D(0) if s['ignoreInducedRefundCost'] else induced)
    admin=D(0)  # no running cost is modelled
    return dict(discount=price,extraSpending=new_sales,gva=value_added,tax=tax,refunds=refund,netFiscal=tax-refund-admin,jobs=value_added*10**9/n('gvaPerJob'),extraVisits=n('visits')*arrivals if s['twoElasticities'] else None)

class IndependentReference(unittest.TestCase):
    def test_varied_scenarios_against_decimal_ledger(self):
        # Read only our executable model, never documentary evidence.
        defaults=json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require(process.argv[1]).DEFAULTS))",str(MODEL)],text=True))
        random_source=random.Random(20260913)
        scenarios=[]
        for index in range(120):
            s=dict(defaults)
            for key,value in s.items():
                if isinstance(value,bool): s[key]=bool(random_source.getrandbits(1))
            for key in ['shoppingShare','eligibility','takeup','passThrough','fee','salience','additionality','taxRate']:
                s[key]=random_source.choice([0,10,30,50,80,100])
            # Only the offered amounts, because the engine normalises to that set.
            s['voucher']=random_source.choice([0,31.9,50,100,150])
            s.update(spending=random_source.choice([0,1,33.2,75]),visits=random_source.choice([1,20,43,90]),vat=random_source.choice([0,5,20,25]),multiplier=random_source.choice([0,1,2.8,4]),gvaPerJob=random_source.choice([30000,75000,100000]))
            for key in ['arrivalsElasticity','spendingElasticity']: s[key]=random_source.choice([0,-.7,-1.3,-1.6,-3])
            scenarios.append(s)
        script="const fs=require('node:fs'),m=require(process.argv[1]); process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(s=>m.calculate(s))));"
        results=json.loads(subprocess.check_output(['node','-e',script,str(MODEL)],input=json.dumps(scenarios),text=True))
        for index,(s,r) in enumerate(zip(scenarios,results)):
            for key,expected in reference(s).items():
                with self.subTest(scenario=index,output=key):
                    if expected is None:
                        self.assertIsNone(r[key])
                    else:
                        value=float(expected)
                        self.assertAlmostEqual(r[key],value,delta=max(1e-9,abs(value)*1e-12))

if __name__=='__main__': unittest.main()
