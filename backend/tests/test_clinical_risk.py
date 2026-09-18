from types import SimpleNamespace
import pytest
from app.risk import calculate
from app.schemas import ForecastCreate
from app.clinical_ai import validate_assessment
from conftest import sign_in
from test_workflows import add, fact, mutate, new_case, run

BASE = dict(systolic_pressure=140, total_cholesterol=213, hdl_cholesterol=50, smoker=False, diabetes=False, bp_treated=False, baseline_cvd=False, confirmed=True)


def score(sex='male', age=55, years=10, **inputs):
    return calculate(SimpleNamespace(age=age, sex=sex), ForecastCreate(expected_version=1, horizon_years=years, inputs={**BASE, **inputs}))


@pytest.mark.parametrize('sex,expected', [('male', .13534025563815144), ('female', .08068318155070242)])
def test_published_fhs_equation_reference_vectors(sex, expected):
    result = score(sex)
    assert result['probability'] == pytest.approx(expected, abs=1e-12)
    assert result['validation_status'] == 'published_equation_not_locally_validated'
    mmol = score(sex, total_cholesterol=213 / 38.67, hdl_cholesterol=50 / 38.67, lipid_unit='mmol/L')
    assert mmol['probability'] == pytest.approx(result['probability'], abs=1e-12)


@pytest.mark.parametrize('overrides,code', [({'age':29}, 'FHS_AGE_OUTSIDE_RANGE'), ({'age':75}, 'FHS_AGE_OUTSIDE_RANGE'), ({'baseline_cvd':True}, 'FHS_BASELINE_CVD'), ({'confirmed':False}, 'RISK_INPUT_CONFIRMATION_REQUIRED'), ({'years':5}, 'UNSUPPORTED_HORIZON'), ({'hdl_cholesterol':250}, 'FHS_INPUT_OUTSIDE_SUPPORTED_RANGE')])
def test_ineligible_risk_never_returns_probability(overrides, code):
    result=score(**overrides)
    assert result['probability'] is None and code in result['unsupported_reasons']


def test_unknown_is_not_false_and_boolean_factors_affect_score():
    result=score(smoker=None)
    assert result['probability'] is None and 'smoker' in result['missing_fields']
    assert score(smoker=True)['probability'] > score()['probability']
    assert score(diabetes=True,bp_treated=True)['probability'] > score()['probability']


def test_risk_history_preserves_input_and_version_and_role(client, case):
    path=f'/cases/{case["id"]}/forecasts'
    body={'expected_version':case['version'],'horizon_years':10,'inputs':BASE}
    first=mutate(client,path,body,key='fhs-immutable')
    assert first.status_code == 200
    assert first.json()['probability'] is not None
    assert mutate(client,path,body,key='fhs-immutable').json()['id'] == first.json()['id']
    add(client,case,[fact('vital.pulse','80',unit='/min')])
    assert mutate(client,path,body).status_code == 409
    original=client.get('/api/v1/forecasts/'+first.json()['id']).json()
    assert original['case_version'] < case['version'] and original['inputs']['total_cholesterol'] == 213
    sign_in(client,'radiologist')
    assert mutate(client,path,{**body,'expected_version':case['version']}).status_code == 403


def test_decision_review_respects_time_negation_and_confirmation(client):
    c=new_case(client)
    add(client,c,[fact('allergy.substance','Substance A','2026-09-18T14:00:00+05:00'), fact('medication.substance','Substance A',order_status='active'), fact('vital.pulse','90',confirmed=False),fact('imaging.side','left',assertion='absent')])
    current=run(client,c,include_ai=False)['result']['decision_review']
    assert next(x for x in current['checks'] if x['code']=='substance_overlap')['status']=='attention'
    historical=run(client,c,include_ai=False,mode='decision_time',decision_time='2026-09-18T10:00:00+05:00')['result']['decision_review']
    assert historical['excluded_facts']==2
    overlap=next(x for x in historical['checks'] if x['code']=='substance_overlap')
    assert overlap['status']=='not_evaluable'
    assert len(overlap['evidence'])==1
    assert historical['clinical_correctness']=='not_assessed'


def test_clinical_conclusion_requires_confirmed_current_evidence(client):
    c=new_case(client)
    assert mutate(client,f'/cases/{c["id"]}/analyses',{'expected_version':1,'review_focus':'clinical_assessment'}).status_code==422
    add(client,c,[fact('symptom.complaint','cough'),fact('vital.pulse','90',unit='/min')])
    facts=client.get(f'/api/v1/cases/{c["id"]}/facts').json()['items']
    body={'expected_version':c['version'],'diagnosis':'Clinician provisional assessment','status':'provisional','rationale':'Reviewed the confirmed source records','fact_ids':[facts[0]['id']],'clinician_confirmed':True}
    path=f'/cases/{c["id"]}/clinical-conclusions'
    assert mutate(client,path,{**body,'clinician_confirmed':False}).status_code==422
    assert mutate(client,path,{**body,'fact_ids':['foreign-fact']}).status_code==422
    saved=mutate(client,path,body)
    assert saved.status_code==201
    detail=client.get(f'/api/v1/cases/{c["id"]}').json()
    assert detail['diagnosis']==body['diagnosis'] and detail['version']==c['version']+1
    assert mutate(client,path,body).status_code==409


def test_model_hypotheses_cannot_cite_invented_or_symptom_free_evidence():
    snapshot={'version':1,'age':55,'sex':'male'}
    evidence=[{'ref':'F1','key':'symptom.complaint','assertion':'present','value':'cough'}]
    result={'case_version':1,'summary':'Cough documented','concerns':[],'limitations':[], 'missing_fields':[], 'assessment':{'status':'requires_clinician_review','differential':[{'supporting_refs':['F99'],'opposing_refs':[]}]}}
    with pytest.raises(ValueError, match='Unsupported'):
        validate_assessment(result,snapshot,evidence)
    result['assessment']['differential'][0]['supporting_refs']=['F1']
    result['summary']='Temperature 42 documented'
    with pytest.raises(ValueError, match='Unsupported numeric'):
        validate_assessment(result,snapshot,evidence)


def test_clinical_output_must_match_the_immutable_case_version():
    snapshot = {'version': 2, 'sex': 'unknown'}
    result = {'case_version': 1, 'summary': 'More confirmed observations are required.', 'concerns': [],
              'limitations': [], 'missing_fields': [], 'assessment': {'status': 'insufficient_data', 'differential': [], 'questions': []}}
    with pytest.raises(ValueError, match='Output version mismatch'):
        validate_assessment(result, snapshot, [])
    result['case_version'] = 2
    assert validate_assessment(result, snapshot, []) == result
