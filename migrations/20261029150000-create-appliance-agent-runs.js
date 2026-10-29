'use strict';
module.exports = {
  async up(q,S) {
    await q.createTable('appliance_agent_runs', {
      id: {type:S.INTEGER,primaryKey:true,autoIncrement:true},
      item_id: {type:S.INTEGER,allowNull:false,references:{model:'home_items',key:'id'},onDelete:'CASCADE'},
      user_id: {type:S.INTEGER,allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},
      request_key: {type:S.STRING(36),allowNull:false},
      status: {type:S.STRING(30),allowNull:false},
      identity: {type:S.JSON,allowNull:false},
      result: {type:S.JSON,allowNull:true},
      created_at: {type:S.DATE,allowNull:false,defaultValue:S.literal('CURRENT_TIMESTAMP')},
      updated_at: {type:S.DATE,allowNull:false,defaultValue:S.literal('CURRENT_TIMESTAMP')}
    });
    await q.addIndex('appliance_agent_runs',['user_id','item_id','request_key'],{unique:true,name:'appliance_agent_run_dedup'});
  },
  async down(q) { await q.dropTable('appliance_agent_runs'); }
};
