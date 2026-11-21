import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model import percentages, poisson_probs, analyze_fixture, completed_before


def game(i, h, a, hg, ag, start, status='FT'):
    return {
        'fixture':{'id':i,'date':start.isoformat(),'status':{'short':status}},
        'teams':{'home':{'id':h,'name':f'Club {h}'}, 'away':{'id':a,'name':f'Club {a}'}},
        'goals':{'home':hg,'away':ag},
        'league':{'id':1,'name':'Liga prueba','country':'Ficticio','season':2026}
    }

class ModelTests(unittest.TestCase):
    def test_probabilities_sum_one(self):
        w,d,l,scores=poisson_probs(2.5,0.6)
        self.assertAlmostEqual(w+d+l,1,places=9)
        self.assertTrue(w>d)
        self.assertTrue(scores)
        self.assertEqual(sum(percentages(w,d,l)),100)

    def test_future_does_not_leak(self):
        base=datetime(2026,11,1,tzinfo=timezone.utc)
        match=game(1,1,2,1,0,base)
        future=game(2,1,2,7,0,base+timedelta(days=1))
        self.assertEqual(len(completed_before([match,future],base+timedelta(hours=3))),1)

    def test_limited_sample_is_excluded(self):
        fixture=game(99,1,2,None,None,datetime(2026,11,21,tzinfo=timezone.utc),'NS')
        pred, reason=analyze_fixture(fixture,[])
        self.assertIsNone(pred)
        self.assertEqual(reason,'liga_sin_muestra')

    def test_strong_local_can_be_selected(self):
        base=datetime(2026,1,1,tzinfo=timezone.utc)
        games=[]
        # Liga ficticia de 8 equipos y 120 encuentros, suficientes para estadísticas.
        for i in range(120):
            home=(i%8)+1
            away=((i*3+3)%8)+1
            if home == away:away= (away%8)+1
            if home==1: hg,ag=4,0
            elif away==1:hg,ag=0,3
            else:hg,ag=(i%3)+1,i%2
            games.append(game(i,home,away,hg,ag,base+timedelta(days=i)))
        future=game(200,1,8,None,None,base+timedelta(days=130),'NS')
        pred,why=analyze_fixture(future,games)
        self.assertIsNotNone(pred,why)
        self.assertGreaterEqual(pred['probabilidades']['local'],60)
        self.assertEqual(sum(pred['probabilidades'].values()),100)
        self.assertIn(pred['confianza'],['alta','media'])
        self.assertEqual(len(pred['forma']['local'])<=6,True)

if __name__=='__main__':unittest.main()
