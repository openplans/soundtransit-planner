$(function(){
  // Combobox builder
	(function( $ ) {
		$.widget( "ui.combobox", {
			_create: function() {
				var self = this,
					select = this.element.hide(),
					selected = select.children( ":selected" ),
					value = selected.val() ? selected.text() : "";
				var input = $( "<input>" )
					.insertAfter( select )
					.val( value )
					.autocomplete({
						delay: 0,
						minLength: 0,
						source: function( request, response ) {
							var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
							response( select.children( "option" ).map(function() {
								var text = $( this ).text();
								if ( this.value && ( !request.term || matcher.test(text) ) )
									return {
										label: text.replace(
											new RegExp(
												"(?![^&;]+;)(?!<[^<>]*)(" +
												$.ui.autocomplete.escapeRegex(request.term) +
												")(?![^<>]*>)(?![^&;]+;)", "gi"
											), "<strong>$1</strong>" ),
										value: text,
										option: this
									};
							}) );
						},
						select: function( event, ui ) {
							ui.item.option.selected = true;
							self._trigger( "selected", event, {
								item: ui.item.option
							});
						},
						change: function( event, ui ) {
							if ( !ui.item ) {
								var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( $(this).val() ) + "$", "i" ),
									valid = false;
								select.children( "option" ).each(function() {
									if ( this.value.match( matcher ) ) {
										this.selected = valid = true;
										return false;
									}
								});
								if ( !valid ) {
									// remove invalid value, as it didn't match anything
									$( this ).val( "" );
									select.val( "" );
									return false;
								}
							}
						}
					})
					.addClass( "ui-widget ui-widget-content ui-corner-left" );

				input.data( "autocomplete" )._renderItem = function( ul, item ) {
					return $( "<li></li>" )
						.data( "item.autocomplete", item )
						.append( "<a>" + item.label + "</a>" )
						.appendTo( ul );
				};

				$( "<button type='button'>&nbsp;</button>" )
					.attr( "tabIndex", -1 )
					.attr( "title", "Show All Items" )
					.insertAfter( input )
					.button({
						icons: {
							primary: "ui-icon-triangle-1-s"
						},
						text: false
					})
					.removeClass( "ui-corner-all" )
					.addClass( "ui-corner-right ui-button-icon" )
					.click(function() {
						// close if already visible
						if ( input.autocomplete( "widget" ).is( ":visible" ) ) {
							input.autocomplete( "close" );
							return false;
						}

						// pass empty string as value to search for, displaying all results
						input.autocomplete( "search", "" );
						input.focus();
						return false;
					});
			}
		});
	})( jQuery );

  // clear
  $('#clear').click(function() {
    $('#to, #from').val("").removeClass('ambiguous').each(function() {blankIfEmpty(this);});
    $('#disambiguation, #tripresult-summaries, div.results').fadeOut('slow');
  });
  
  // to/from fields
  function blankIfEmpty(element) {
    ($(element).val() == "") ? $(element).addClass('blank') : $(element).removeClass('blank');
  }
  $('#to, #from').bind('blur, change', function(event, ui) {blankIfEmpty(this);});
  $('#to, #from').each(function() {blankIfEmpty(this);});
  
  
  
  //Spinner		  
	$('#leaveminute').spinner({ min: 0, max: 59, increment: 'fast' });
	//Force zero-padding
	function zeropad(value) { return (parseInt(value) < 10) ? ("0" + value) : value;}
	
	$('#leaveminute').bind('change', function(event, ui) {this.value = zeropad(this.value);});
	

	
	$( "#leaveday" ).datepicker({
		showOn: "button",
		buttonImage: "img/calendar.png",
		buttonImageOnly: true
	});
	
	//initialize time
	var d = new Date();

	$('#leavehour').val((d.getHours() > 12) ? (d.getHours() -12) : d.getHours());
	
	$('#leaveminute').val(zeropad(d.getMinutes()));
  
  if (d.getHours() > 12) {$('#leaveampm option[value="pm"]').attr('selected', 'selected');}
  
  $('#leaveday').val(zeropad(d.getMonth() + 1) + "/" + zeropad(d.getDate()) + "/" + d.getFullYear());

  
  // Must happen after initializing time
  $( "#leavetype, #leaveampm, #trippriority, #maxwalk" ).combobox();
  
  $("#tofromtoggle").click(function() {
    var tempSwapVal = $("#from").val();
    $("#from").val($("#to").val()).each(function() {blankIfEmpty(this);});
    $("#to").val(tempSwapVal).each(function() {blankIfEmpty(this);});
  });
  
  
  // table row focus
  $('#tripresult-summaries tbody tr').click(function() {
    $('#tripresult-summaries tr').removeClass("active");
    $(this).addClass("active");
    $('#' + (this.id).split('-')[0] + '-results').slideDown().addClass("active");
    $('.results').not('#' + (this.id).split('-')[0] + '-results').slideUp().removeClass("active");
  });
  
  //More options
  $('a#optionstoggle').click(function() {
    if ($(this).hasClass('active')) {
      $('#moreoptions').hide();
      $(this).html('More Options<span></span>').removeClass('active');
    } else {
      $('#moreoptions').show();
      $(this).html('Fewer Options<span></span>').addClass('active');
    }
  });
  
  // Disambiguation links
  var disParent = $('#disambiguation');
  var disTarget = (disParent.hasClass('from')) ? $('#from') : $('#to');
  $('#disambiguation ol li').click(function() {
    disTarget.val($(this).children('strong').text()).removeClass('ambiguous').each(function() {blankIfEmpty(this);});
    disParent.fadeOut('slow');
  });
  
});