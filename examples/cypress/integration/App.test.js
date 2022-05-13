describe('App', () => {
  it('should render on desktop', () => {
    cy.visit('http://demoqa.com');

    cy.matchImageSnapshot();
  });

  it('should render on mobile', () => {
    cy.visit('http://demoqa.com');

    cy.viewport(375, 812);
    cy.matchImageSnapshot('mobile/app');
  });
});
