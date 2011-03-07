/* Copyright 2010, OpenPlans
 
 This program is free software: you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation, either version 3 of
 the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>. */
package org.openplans.delayfeeder.feed;

import java.util.Calendar;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinColumns;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

@Entity
@Table(name = "route_feed_item")
@org.hibernate.annotations.Entity(mutable = true)
public class RouteFeedItem {
	@Id
	@GeneratedValue
	private long id;

	@ManyToOne(cascade=CascadeType.ALL)
    @JoinColumns ({
        @JoinColumn(name="feed_id", referencedColumnName = "id"),
    })
	public RouteFeed feed;

	@Column(name="description", nullable=false, length=30000)
	public String description;
	public Calendar date;

	public String link;
	
	public String category;
	
	public long getId() {
		return id;
	}
}
