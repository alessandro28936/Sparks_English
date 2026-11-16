(() => {
  // JU and CL.JU Third-account assignments are determined by center, not launch date.
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
  const saved={scope,workView};
  const make=(adset,account='Third',brand='English',status='active')=>
    A.normalize([{'Campaign name':'Traffic_WA_Diversified_Third',
      'Ad set name':adset,'Ad name':'12/11/26 - I_TEST','Day':'2026-11-15',
      'Ad delivery':status,'Account Group':account,'Brand':brand,
      'Amount spent (IDR)':1000,Results:1,Leads:1,Booking:0,
      'Result type':'Messaging conversations started'}])[0];
  try {
    scope='MY';workView='centers';
    const live=make('ALLS-ENG-CL.JU_T_D_W_TA_12/11/26');
    check('Live Third CL.JU 12 Nov is normalized as CL.JU and owned',live.center==='CL.JU'&&ownedRow(live));
    check('Live Third CL.JU is included in My assignments',workspaceMatches(live));
    check('Third CL.JU historical date also owned',ownedRow(make('ALLS-ENG-CL.JU_T_D_W_TA_3/11/26')));
    check('Third JU 1 Nov historical ad set owned',ownedRow(make('ALLS-ENG-JU_T_D_W_TA_1/11/26')));
    check('Third JU 2 Nov historical ad set owned',ownedRow(make('ALLS-ENG-JU_T_D_W_TA_2/11/26')));
    check('Third JU future launch date owned',workspaceMatches(make('ALLS-ENG-JU_T_D_W_TA_18/11/26')));
    check('Third CL.JU future launch date owned',workspaceMatches(make('ALLS-ENG-CL.JU_T_D_W_TA_18/11/26')));
    check('Third unrelated BGR is excluded',!workspaceMatches(make('ALLS-ENG-BGR_T_D_W_TA_2/11/26')));
    check('Third unrelated BLI is excluded',!workspaceMatches(make('ALLS-ENG-BLI_T_D_W_TA_2/11/26')));
    check('Third SLSA is excluded',!workspaceMatches(make('ALLS-ENG-CL.JU_T_D_W_TA_12/11/26','Third','SLSA')));
    check('Main-account CL.JU remains in My assignments',workspaceMatches(make('CL.JU_T_M_W_1/5/26','Main')));
    check('Secondary-account CL.JU remains in My assignments',workspaceMatches(make('CL.JU_T_M_W_1/5/26','Secondary')));
    const inactive=make('ALLS-ENG-JU_T_D_W_TA_2/11/26','Third','English','inactive');
    check('Historical inactive Third JU is included without falsifying delivery',workspaceMatches(inactive)&&inactive.status==='inactive');
    workView='preheat';
    check('Center workspace scope still excludes preheat-only view',!workspaceMatches(live));
    workView='centers';scope='ALL';
    check('All assignments still includes unrelated Third centers',workspaceMatches(make('ALLS-ENG-BGR_T_D_W_TA_2/11/26')));
  } finally {scope=saved.scope;workView=saved.workView;}
  return checks;
})()
